import type { default as OrganizationType } from '../../organization.model';
import type { default as UserType, IUserDoc } from '../../user.model';
import { connectToDatabase, closeDatabase, clearDatabase } from '../../../test-utils/mongo';
import type * as mongooseType from 'mongoose';
import { loadUser } from '../../../test-utils/user';
import { loadOrganization, createOrganizationTeamUserPreset, organizationTestConfig } from '../../../test-utils/organization';
import { loadCommonRequireMock } from '../../../test-utils/requireMock';
import { makeTypeSafeSchema } from '../../model-utils';
import { ITestDoc, ITestModel, ITest, TestAccessControl, TEST_ROLES, TestRoles } from './role-assignment.test-data';
import { RoleAssignmentPlugin, RestrictedModel } from './role-assignment';

describe('Role assignment plugin', () => {
    let Organization: typeof OrganizationType;
    let User: typeof UserType;
    let mongoose: typeof mongooseType;
    let TestModel: ITestModel;
    let TestSchema;
    let testObject: ITestDoc;

    beforeAll(async () => {
        jest.resetModules();
        mongoose = require('mongoose');
        await connectToDatabase(mongoose);
        loadCommonRequireMock(jest, organizationTestConfig);

        User = loadUser();
        Organization = loadOrganization();
        TestSchema = makeTypeSafeSchema(
            new mongoose.Schema<ITestDoc, ITestModel>({
                name: String
            } as Record<keyof ITest, any>)
        );
        const doUserHaveAtLeastDefaultAccessRole = async (user: IUserDoc, objectId: mongooseType.Types.ObjectId): Promise<boolean> => {
            const testObject = await TestModel.findOne({ _id: objectId });
            return user.displayName === testObject?.name;
        };
        TestSchema.plugin(RoleAssignmentPlugin, {
            roleList: TestAccessControl.getRoles(),
            atLeastDefaultRoleMatcher: doUserHaveAtLeastDefaultAccessRole
        });
        TestModel = mongoose.model('TestModel', TestSchema.unsafeSchema);

        testObject = await new TestModel({ name: 'test1' }).save();
    });
    afterAll(() => closeDatabase(mongoose));
    beforeEach(async () => {
        await clearDatabase(mongoose);
        testObject = await new TestModel({ name: 'test1' }).save();
    });

    test('randomUser should not be "atLeastDefaultRoleMatcher"', async () => {
        const randomUser = await User.createUser({
            displayName: 'noDefaultAccess'
        });
        expect(await TestModel.isAuthorized(testObject.id!, undefined, randomUser)).toBeFalsy();
    });
    test('regularUser that passes "atLeastDefaultRoleMatcher" should be authorized for default role', async () => {
        const regularUser = await User.createUser({
            displayName: 'test1'
        });
        expect(await TestModel.isAuthorized(testObject.id!, undefined, regularUser)).toBeTruthy();
    });
    test('user with role should pass isAuthorized for the assigned and default roles"', async () => {
        const editorUser = await User.createUser({
            displayName: 'admin'
        });

        await TestModel.setUserRole(testObject.id!, TEST_ROLES.EDITOR, editorUser._id!);
        expect(await TestModel.isAuthorized(testObject.id!, [TEST_ROLES.EDITOR], editorUser)).toBeTruthy();
        // user with role have at least default role
        expect(await TestModel.isAuthorized(testObject.id!, undefined, editorUser)).toBeTruthy();

        // Reflacted in DB
        const roleAssignment = ((await TestModel.findOne({ _id: testObject._id! }))! as unknown as RestrictedModel<TestRoles>)
            .accessControlList![0]!;
        expect(roleAssignment.role).toBe(TEST_ROLES.EDITOR);
        expect(roleAssignment.userId!.toString()).toStrictEqual(editorUser._id!.toString());
        expect(roleAssignment.teamId).toBeUndefined();

        await TestModel.removeUserRole(testObject.id!, editorUser._id!);
        expect(await TestModel.isAuthorized(testObject.id!, [TEST_ROLES.EDITOR], editorUser)).toBeFalsy();
        expect(await TestModel.isAuthorized(testObject.id!, undefined, editorUser)).toBeFalsy();

        // Reflacted in DB
        expect(
            ((await TestModel.findOne({ _id: testObject._id! }))! as unknown as RestrictedModel<TestRoles>).accessControlList
        ).toHaveLength(0);
    });

    test('user with team role should pass isAuthorized for the assigned and default roles"', async () => {
        const { team, user } = await createOrganizationTeamUserPreset(User, Organization);

        await TestModel.setTeamRole(testObject.id!, TEST_ROLES.EDITOR, team.id!);
        expect(await TestModel.isAuthorized(testObject.id!, [TEST_ROLES.EDITOR], user)).toBeTruthy();
        // user with team role have at least default role
        expect(await TestModel.isAuthorized(testObject.id!, undefined, user)).toBeTruthy();

        // Reflacted in DB
        const roleAssignment = ((await TestModel.findOne({ _id: testObject._id! }))! as unknown as RestrictedModel<TestRoles>)
            .accessControlList![0]!;
        expect(roleAssignment.role).toBe(TEST_ROLES.EDITOR);
        expect(roleAssignment.teamId!.toString()).toStrictEqual(team._id!.toString());
        expect(roleAssignment.userId).toBeUndefined();

        await TestModel.removeTeamRole(testObject.id!, team._id!);
        expect(await TestModel.isAuthorized(testObject.id!, [TEST_ROLES.EDITOR], user)).toBeFalsy();
        expect(await TestModel.isAuthorized(testObject.id!, undefined, user)).toBeFalsy();

        // Reflacted in DB
        expect(
            ((await TestModel.findOne({ _id: testObject._id! }))! as unknown as RestrictedModel<TestRoles>).accessControlList
        ).toHaveLength(0);
    });
});
