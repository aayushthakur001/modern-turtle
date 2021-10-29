import type { default as OrganizationType } from '../../organization.model';
import type { default as UserType, IUserDoc } from '../../user.model';
import { connectToDatabase, closeDatabase, clearDatabase } from '../../../test-utils/mongo';
import type * as mongooseType from 'mongoose';
import { loadUser } from '../../../test-utils/user';
import { loadOrganization, createOrganizationTeamUserPreset, organizationTestConfig } from '../../../test-utils/organization';
import { loadCommonRequireMock } from '../../../test-utils/requireMock';
import { makeTypeSafeSchema } from '../../model-utils';
import { ITestDoc, ITestModel, ITest, TestAccessControl, TEST_ROLES } from './role-assignment.test-data';
import { NestedRoleAssignmentPlugin, RestrictedNestedModel } from './role-assignment-nested';
import { ITestOrgDoc, ITestOrgModel, TEST_ORG_NESTED_ENTITY_FIELDS } from './role-assignment-nested.test-data';

describe('Role assignment nested plugin', () => {
    let Organization: typeof OrganizationType;
    let User: typeof UserType;
    let mongoose: typeof mongooseType;
    let TestOrgModel: ITestOrgModel;
    let TestSchema;
    let TestOrgSchema;
    let testOrgObject: ITestOrgDoc;
    let testObject: ITestDoc;
    const { tests } = TEST_ORG_NESTED_ENTITY_FIELDS;

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
            return !!objectId && user.displayName === 'defaultable';
        };
        TestOrgSchema = makeTypeSafeSchema(
            new mongoose.Schema<ITestDoc, ITestModel>({
                name: String,
                tests: [TestSchema]
            } as Record<keyof ITest, any>)
        );
        TestOrgSchema.plugin(NestedRoleAssignmentPlugin, {
            controlledNestedEntities: [
                {
                    roleList: TestAccessControl.getRoles(),
                    atLeastDefaultRoleMatcher: doUserHaveAtLeastDefaultAccessRole,
                    field: tests,
                    schema: TestSchema
                }
            ]
        });
        TestOrgModel = mongoose.model('TestOrgModel', TestOrgSchema.unsafeSchema) as unknown as ITestOrgModel;
    });
    afterAll(() => closeDatabase(mongoose));
    beforeEach(async () => {
        await clearDatabase(mongoose);
        testObject = { name: 'testObject' } as ITestDoc;
        testObject._id = mongoose.Types.ObjectId();
        testObject.id = testObject._id.toString();
        testOrgObject = await new TestOrgModel({ name: 'test1', tests: [testObject] }).save();
    });

    test('randomUser should not be "atLeastDefaultRoleMatcher"', async () => {
        const randomUser = await User.createUser({
            displayName: 'noDefaultAccess'
        });
        expect(await TestOrgModel.isAuthorizedNestedDoc(testOrgObject.id!, tests, testObject.id!, undefined, randomUser)).toBeFalsy();
    });
    test('regularUser that passes "atLeastDefaultRoleMatcher" should be authorized for default role', async () => {
        const regularUser = await User.createUser({
            displayName: 'defaultable'
        });
        expect(await TestOrgModel.isAuthorizedNestedDoc(testOrgObject.id!, tests, testObject.id!, undefined, regularUser)).toBeTruthy();
    });
    test('user with role should pass isAuthorized for the assigned and default roles"', async () => {
        const editorUser = await User.createUser({
            displayName: 'admin'
        });

        await TestOrgModel.setNestedUserRole(testOrgObject.id!, tests, testObject.id!, TEST_ROLES.EDITOR, editorUser._id!);
        expect(
            await TestOrgModel.isAuthorizedNestedDoc(testOrgObject.id!, tests, testObject.id!, [TEST_ROLES.EDITOR], editorUser)
        ).toBeTruthy();
        // user with role have at least default role
        expect(await TestOrgModel.isAuthorizedNestedDoc(testOrgObject.id!, tests, testObject.id!, undefined, editorUser)).toBeTruthy();

        const roleAssignment = ((await TestOrgModel.findOne({ _id: testOrgObject._id! }))!.tests![0]! as unknown as RestrictedNestedModel)
            .accessControlList![0]!;
        expect(roleAssignment.role).toBe(TEST_ROLES.EDITOR);
        expect(roleAssignment.userId!.toString()).toStrictEqual(editorUser._id!.toString());
        expect(roleAssignment.teamId).toBeUndefined();

        await TestOrgModel.removeNestedUserRole(testOrgObject.id!, tests, testObject.id!, editorUser._id!);
        expect(
            await TestOrgModel.isAuthorizedNestedDoc(testOrgObject.id!, tests, testObject.id!, [TEST_ROLES.EDITOR], editorUser)
        ).toBeFalsy();
        expect(await TestOrgModel.isAuthorizedNestedDoc(testOrgObject.id!, tests, testObject.id!, undefined, editorUser)).toBeFalsy();

        expect(
            ((await TestOrgModel.findOne({ _id: testOrgObject._id! }))!.tests![0]! as unknown as RestrictedNestedModel).accessControlList
        ).toHaveLength(0);
    });

    test('user with team role should pass isAuthorized for the assigned and default roles"', async () => {
        const { team, user } = await createOrganizationTeamUserPreset(User, Organization);

        await TestOrgModel.setNestedTeamRole(testOrgObject.id!, tests, testObject.id!, TEST_ROLES.EDITOR, team.id!);
        expect(await TestOrgModel.isAuthorizedNestedDoc(testOrgObject.id!, tests, testObject.id!, [TEST_ROLES.EDITOR], user)).toBeTruthy();
        // user with team role have at least default role
        expect(await TestOrgModel.isAuthorizedNestedDoc(testOrgObject.id!, tests, testObject.id!, undefined, user)).toBeTruthy();

        const roleAssignment = ((await TestOrgModel.findOne({ _id: testOrgObject._id! }))!.tests![0]! as unknown as RestrictedNestedModel)
            .accessControlList![0]!;
        expect(roleAssignment.role).toBe(TEST_ROLES.EDITOR);
        expect(roleAssignment.teamId!.toString()).toStrictEqual(team._id!.toString());
        expect(roleAssignment.userId).toBeUndefined();

        await TestOrgModel.removeNestedTeamRole(testOrgObject.id!, tests, testObject.id!, team._id!);
        expect(await TestOrgModel.isAuthorizedNestedDoc(testOrgObject.id!, tests, testObject.id!, [TEST_ROLES.EDITOR], user)).toBeFalsy();
        expect(await TestOrgModel.isAuthorizedNestedDoc(testOrgObject.id!, tests, testObject.id!, undefined, user)).toBeFalsy();

        expect(
            ((await TestOrgModel.findOne({ _id: testOrgObject._id! }))!.tests![0]! as unknown as RestrictedNestedModel).accessControlList
        ).toHaveLength(0);
    });
});
