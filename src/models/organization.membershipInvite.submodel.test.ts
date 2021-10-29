import type { default as OrganizationType } from './organization.model';
import type { default as UserType, IUser } from './user.model';
import { connectToDatabase, clearDatabase, closeDatabase } from '../test-utils/mongo';
import type * as mongooseType from 'mongoose';
import { fetchUser, loadUser } from '../test-utils/user';
import { expectedNotFoundError, getThrownError } from '../test-utils/error';
import { createOrganizationTeamUserPreset, loadOrganization, organizationTestConfig } from '../test-utils/organization';
import { loadCommonRequireMock } from '../test-utils/requireMock';
import { OrganizationRole, ORGANIZATION_ROLES } from './organization-models-access-control';
import uuid from 'uuid';

describe('Organization Role Invite Sub Model', () => {
    let Organization: typeof OrganizationType;
    let User: typeof UserType;
    let mongoose: typeof mongooseType;
    let preset: Record<string, any>;
    const inviteeEmail = 'newUser@user.co';
    const inviteeRole = ORGANIZATION_ROLES.ORG_ADMIN;

    beforeAll(async () => {
        jest.resetModules();
        mongoose = require('mongoose');
        await connectToDatabase(mongoose);
        loadCommonRequireMock(jest, organizationTestConfig);
        User = loadUser();
        Organization = loadOrganization();
    });
    beforeEach(async () => {
        await clearDatabase(mongoose);
        preset = await createOrganizationTeamUserPreset(User, Organization);
    });
    afterAll(() => closeDatabase(mongoose));

    test('statics.addMembershipInvite', async () => {
        const { org, user: orgUser } = preset;

        const { organization: updatedOrg, token } = await Organization.addMembershipInvite(org._id, orgUser, inviteeEmail, inviteeRole);

        expect(updatedOrg.membershipInvites).toHaveLength(1);
        const createdInvite = updatedOrg.membershipInvites![0]!;
        expect(createdInvite.email).toBe(inviteeEmail);
        expect(createdInvite.role).toBe(inviteeRole);
        expect(createdInvite.token).toBe(token);
    });

    test('statics.removeMembershipInvite', async () => {
        const { org, user: orgUser } = preset;

        const updatedOrg = (await Organization.addMembershipInvite(org._id, orgUser, inviteeEmail, inviteeRole)).organization;

        const createdInvite = updatedOrg.membershipInvites![0]!;
        const inviteId = createdInvite.id!;
        const postRemoveOrg = await Organization.removeMembershipInvite(org._id, orgUser, inviteId);

        expect(postRemoveOrg.membershipInvites).toHaveLength(0);
    });

    test('statics.acceptMembershipInvite', async () => {
        const { org, user: orgUser } = preset;

        let updatedOrg = (await Organization.addMembershipInvite(org._id, orgUser, inviteeEmail, inviteeRole)).organization;

        const createdInvite = updatedOrg.membershipInvites![0]!;

        let newUser = await User.createUser({
            displayName: 'newUser',
            email: inviteeEmail
        } as Partial<IUser>);

        updatedOrg = await Organization.acceptMembershipInvite(org._id, newUser, createdInvite.token);
        expect(updatedOrg.membershipInvites).toHaveLength(0);
        newUser = await fetchUser(newUser._id!);

        expect(newUser.organizationMemberships).toHaveLength(1);
        const membership = newUser.organizationMemberships![0]!;
        expect(membership.organizationId).toStrictEqual(org._id!);
        expect(await Organization.isAuthorized(org.id!, undefined, newUser)).toBeTruthy();
        expect(await Organization.isAuthorized(org.id!, [inviteeRole], newUser)).toBeTruthy();

        const userOrg = (await Organization.findOrganizations(newUser))![0]!;
        expect(updatedOrg._id!).toStrictEqual(userOrg._id);
    });

    test('statics.removeMembershipInvite validation', async () => {
        const { org, user: orgUser } = preset;

        const updatedOrg = (await Organization.addMembershipInvite(org._id, orgUser, inviteeEmail, inviteeRole)).organization;

        const createdInvite = updatedOrg.membershipInvites![0]!;
        const inviteId = createdInvite.id!;

        expect(
            await getThrownError(() => {
                return Organization.removeMembershipInvite(mongoose.Types.ObjectId(), orgUser, inviteId);
            })
        ).toStrictEqual(expect.objectContaining(expectedNotFoundError));

        expect(
            await getThrownError(() => {
                return Organization.removeMembershipInvite(org._id, orgUser, 'notExistingToken');
            })
        ).toStrictEqual(expect.objectContaining(expectedNotFoundError));
    });

    test('statics.addMembershipInvite validation', async () => {
        const { org, user: orgUser } = preset;

        // unknown org id
        expect(
            await getThrownError(() => {
                return Organization.addMembershipInvite(mongoose.Types.ObjectId(), orgUser, inviteeEmail, inviteeRole);
            })
        ).toStrictEqual(expect.objectContaining(expectedNotFoundError));

        // missing email
        expect(
            await getThrownError(() => {
                return Organization.addMembershipInvite(org._id, orgUser, '', inviteeRole);
            })
        ).toStrictEqual(
            expect.objectContaining({
                status: 400,
                name: 'InvalidEmailAddress',
                message: 'Email is not valid.'
            })
        );

        // bad email
        expect(
            await getThrownError(() => {
                return Organization.addMembershipInvite(org._id, orgUser, 'bademailaddress', inviteeRole);
            })
        ).toStrictEqual(
            expect.objectContaining({
                status: 400,
                name: 'InvalidEmailAddress',
                message: 'Email is not valid.'
            })
        );

        // unknown role
        expect(
            await getThrownError(() => {
                return Organization.addMembershipInvite(
                    org._id,
                    orgUser,
                    inviteeEmail,
                    'role_that_doesnt_exists' as unknown as OrganizationRole
                );
            })
        ).toStrictEqual(
            expect.objectContaining({
                status: 400,
                name: 'InvalidRole',
                message: 'Role is not valid.'
            })
        );
    });

    test('statics.acceptMembershipInvite validation', async () => {
        const { org, user: orgUser } = preset;
        let updatedOrg = (await Organization.addMembershipInvite(org._id, orgUser, inviteeEmail, inviteeRole)).organization;

        let createdInvite = updatedOrg.membershipInvites![0]!;

        let newUser = await User.createUser({
            displayName: 'newUser',
            email: inviteeEmail
        } as Partial<IUser>);

        // unknown org id
        expect(
            await getThrownError(() => {
                return Organization.acceptMembershipInvite(mongoose.Types.ObjectId(), newUser, createdInvite.token);
            })
        ).toStrictEqual(expect.objectContaining(expectedNotFoundError));

        // unknown token
        expect(
            await getThrownError(() => {
                return Organization.acceptMembershipInvite(org._id, newUser, uuid());
            })
        ).toStrictEqual(expect.objectContaining(expectedNotFoundError));

        const nonInvitedUser = await User.createUser({
            displayName: 'newUser',
            email: 'nonInvitedUser@user.co'
        } as Partial<IUser>);

        // user email is not matching
        expect(
            await getThrownError(() => {
                return Organization.acceptMembershipInvite(org._id, nonInvitedUser, createdInvite.token);
            })
        ).toStrictEqual(
            expect.objectContaining({
                status: 400,
                name: 'OrganizationAcceptInviteWithDifferentEmailAddress',
                message: 'To accept the invite you must register with the invited email address.'
            })
        );

        // accept and add new role again
        updatedOrg = await Organization.acceptMembershipInvite(org._id, newUser, createdInvite.token);
        expect(updatedOrg.membershipInvites).toHaveLength(0);
        newUser = await fetchUser(newUser._id!);

        expect(newUser.organizationMemberships).toHaveLength(1);
        const membership = newUser.organizationMemberships![0]!;
        expect(membership.organizationId).toStrictEqual(org._id!);
        expect(await Organization.isAuthorized(org.id!, undefined, newUser)).toBeTruthy();
        expect(await Organization.isAuthorized(org.id!, [inviteeRole], newUser)).toBeTruthy();

        const userOrg = (await Organization.findOrganizations(newUser))![0]!;
        expect(updatedOrg._id!).toStrictEqual(userOrg._id);

        // Invite user to an existing role again
        updatedOrg = (await Organization.addMembershipInvite(org._id, orgUser, inviteeEmail, inviteeRole)).organization;
        createdInvite = updatedOrg.membershipInvites![0]!;
        expect(
            await getThrownError(() => {
                return Organization.acceptMembershipInvite(org._id, newUser, createdInvite.token);
            })
        ).toStrictEqual(
            expect.objectContaining({
                status: 400,
                name: 'OrganizationRoleAlreadyExists',
                message: 'You already have a role in this organization.'
            })
        );
    });
});
