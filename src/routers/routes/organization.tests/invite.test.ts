import type * as mongooseType from 'mongoose';
import type * as expressType from 'express';
import * as httpType from 'http';
import request from 'supertest';
import type * as SuperTest from 'supertest';
import { clearDatabase, closeDatabase } from '../../../test-utils/mongo';
import type { IUser, IUserDoc, IUserModel } from '../../../models/user.model';
import { configData } from '../../../test-utils/server.config';
import { mockUserAuthRequest, startServer, MOCK_PROVIDER } from '../../../test-utils/server';
import type { IOrganizationModel, IOrganizationDoc } from '../../../models/organization.model';
import { loadUser } from '../../../test-utils/user';
import { loadOrganization } from '../../../test-utils/organization';

describe('Organization invite', () => {
    let config: any;
    let app: expressType.Application;
    let server: httpType.Server;
    let mongoose: typeof mongooseType;
    let user: IUserDoc;
    let User: IUserModel;
    let Organization: IOrganizationModel;
    let organization: IOrganizationDoc;
    let agent: SuperTest.SuperTest<SuperTest.Test>;
    const viewerInviteData = {
        email: 'test@stackbit.com',
        role: 'ORG_ADMIN'
    };

    beforeAll(async () => {
        jest.resetModules();

        config = {
            ...configData,
            default: configData,
            loadConfig: () => Promise.resolve(configData)
        };
        jest.mock('../../../config', () => config);

        mongoose = require('mongoose');
        const runner = await startServer({ mongoose, jest, configData, provider: MOCK_PROVIDER });
        server = runner.server;
        app = runner.app;
        agent = request(app);

        jest.mock('../../../services/customerio-service/customerio-transactional-service', () => ({
            organizationMembershipInviteEmail: jest.fn()
        }));

        User = loadUser();
        Organization = loadOrganization();
    }, 10000);

    beforeEach(async () => {
        await clearDatabase(mongoose);

        user = await User.createUser({
            email: 'admin@organization.com'
        } as Partial<IUser>);

        organization = await new Organization({
            name: 'org1'
        }).save();

        await Organization.addUser(organization._id!, user._id!);

        await Organization.setUserRole(organization.id!, 'ORG_ADMIN', user._id!);

        user = (await User.findById(user._id))!;

        mockUserAuthRequest(user);
    });

    afterAll(async () => {
        await closeDatabase(mongoose);
        server.close();
    });

    function inviteRole(organizationId: string | mongooseType.Types.ObjectId, data: { email?: string; role?: string }): SuperTest.Test {
        return agent.post(`/organization/${organizationId}/invite/send/`).send(data);
    }

    describe('invite organization role', () => {
        test('with invalid email', async () => {
            const invalidEmails = ['', 'email.com'];

            await Promise.all(
                invalidEmails.map(async (email) => {
                    const data = await inviteRole(organization._id!, { email }).expect('Content-Type', /json/).expect(400);
                    expect(data.body.message).toBe('Email is not valid.');
                })
            );
        });

        test('with no role', async () => {
            const inviteData = {
                email: 'test@stackbit.com',
                role: ''
            };
            const response = await inviteRole(organization._id!, inviteData).expect('Content-Type', /json/).expect(200);

            expect(response.body.id).toBe(organization.id);
        });

        describe('by user', () => {
            let anotherUser: IUserDoc;
            beforeEach(async () => {
                anotherUser = await User.createUser({
                    email: 'another@user.com',
                    roles: ['user']
                } as Partial<IUser>);

                anotherUser = (await User.findById(anotherUser.id))!;
                mockUserAuthRequest(anotherUser);
            });

            test('not associated with organization', async () => {
                const response = await inviteRole(organization._id!, viewerInviteData).expect('Content-Type', /json/);
                expect(response.statusCode).toBe(403);
            });

            test('with no permissions to invite', async () => {
                await Organization.addUser(organization._id!, anotherUser._id!);

                const response = await inviteRole(organization._id!, viewerInviteData).expect('Content-Type', /json/);

                expect(response.statusCode).toBe(403);
            });

            test('with permissions to invite', async () => {
                await Organization.addUser(organization._id!, anotherUser._id!);

                await Organization.setUserRole(organization.id!, 'ORG_ADMIN', anotherUser._id!);
                anotherUser = (await User.findOne(anotherUser._id!))!;
                mockUserAuthRequest(anotherUser);

                const addMembershipInviteSpyOn = jest
                    .spyOn(Organization, 'addMembershipInvite')
                    .mockImplementation((): any => Promise.resolve({ organization, token: 'token' }));

                const response = await inviteRole(organization._id!, viewerInviteData).expect('Content-Type', /json/);

                expect(response.statusCode).toBe(200);

                expect(Organization.addMembershipInvite).toHaveBeenLastCalledWith(
                    organization._id,
                    expect.objectContaining({
                        _id: anotherUser._id!
                    }),
                    viewerInviteData.email,
                    viewerInviteData.role
                );

                addMembershipInviteSpyOn.mockRestore();
            });
        });
    });

    describe('delete invite organization role', () => {
        let anotherUser: IUserDoc;
        let inviteId: string;
        function delInviteRole(organizationId: string | mongooseType.Types.ObjectId, invitationId: string): SuperTest.Test {
            return agent.delete(`/organization/${organizationId}/invite/delete/${invitationId}`).send();
        }

        test('with no permissions to delete', async () => {
            anotherUser = await User.createUser({
                email: 'another@user.com',
                roles: ['user']
            } as Partial<IUser>);

            anotherUser = (await User.findById(anotherUser.id))!;
            mockUserAuthRequest(anotherUser);

            await Organization.addUser(organization._id!, anotherUser._id!);

            const response = await delInviteRole(organization._id!, inviteId).expect('Content-Type', /json/);

            expect(response.statusCode).toBe(403);
        });

        test('with permissions to delete', async () => {
            mockUserAuthRequest(user);
            const inviteResponse = await inviteRole(organization._id!, viewerInviteData);
            inviteId = inviteResponse.body.membershipInvites![0]!._id!.toString();
            const response = await delInviteRole(organization._id!, inviteId).expect('Content-Type', /json/);

            expect(response.statusCode).toBe(200);
            expect(response.body.membershipInvites).toHaveLength(0);
        });
    });

    describe('accept invite', () => {
        let invitedOrgAdmin: IUserDoc;
        const inviteeEmail = 'invited@organization.com';
        let token: string;

        test('by owner', async () => {
            mockUserAuthRequest(user);
            token = (await Organization.addMembershipInvite(organization._id!, user, user.email!, 'ORG_ADMIN')).token;

            const response = await agent.post(`/organization/${organization.id!}/invite/accept/?token=${token}`).expect(400);

            expect(response.body.name).toBe('OrganizationRoleAlreadyExists');
            expect(response.body.message).toBe('You already have a role in this organization.');
        });

        test('with invalid token', async () => {
            invitedOrgAdmin = await User.createUser({
                email: inviteeEmail
            } as Partial<IUser>);
            invitedOrgAdmin = (await User.findById(invitedOrgAdmin._id))!;
            token = (await Organization.addMembershipInvite(organization._id!, user, inviteeEmail, 'ORG_ADMIN')).token;

            mockUserAuthRequest(invitedOrgAdmin);

            // accept invite to make token invalid in second request
            await agent.post(`/organization/${organization.id!}/invite/accept/?token=${token}`);

            const tokens = [null, 'invalidToken', '1234567890', token];
            (
                await Promise.all(
                    tokens.map(async (t) => {
                        return agent.post(`/organization/${organization.id!}/invite/accept/?${t && `token=${t}`}`);
                    })
                )
            ).forEach((res) => {
                expect(res?.body.name).toBe('NotFound');
                expect(res?.body.status).toBe(404);
            });
        });

        describe('by user', () => {
            beforeEach(async () => {
                organization = await new Organization({
                    name: 'org1'
                }).save();

                token = (await Organization.addMembershipInvite(organization._id!, user, inviteeEmail, 'ORG_ADMIN')).token;
            });

            test('with different email then it was invited', async () => {
                const invitedOrgAdminWithDifferentEmail = await User.createUser({
                    email: 'invited@different.email'
                } as Partial<IUser>);
                mockUserAuthRequest(invitedOrgAdminWithDifferentEmail);

                const addRoleSpy = jest.spyOn(Organization, 'setUserRole').mockImplementation(jest.fn(() => Promise.resolve()));
                const response = await agent.post(`/organization/${organization.id}/invite/accept?token=${token}`).expect(400);
                expect(response.body.name).toBe('OrganizationAcceptInviteWithDifferentEmailAddress');
                expect(Organization.setUserRole).toHaveBeenCalledTimes(0);
                addRoleSpy.mockRestore();
            });

            test('with same email then it was invited', async () => {
                const userWithRoleEmail = 'invited-user-to-org@email.co';
                const invitedUserWithRole = await User.createUser({
                    email: userWithRoleEmail
                } as Partial<IUser>);
                mockUserAuthRequest(invitedUserWithRole);

                token = (await Organization.addMembershipInvite(organization._id!, user, userWithRoleEmail, 'ORG_ADMIN')).token;

                const addRoleSpy = jest.spyOn(Organization, 'setUserRole').mockImplementation(jest.fn(() => Promise.resolve()));
                await agent.post(`/organization/${organization.id}/invite/accept/?token=${token}`).expect(200);
                expect(Organization.setUserRole).toHaveBeenCalledWith(organization.id, 'ORG_ADMIN', invitedUserWithRole._id);
                addRoleSpy.mockRestore();
            });

            test('with no role and same email then it was invited', async () => {
                const userWithRoleEmail = 'invited-user-to-org@email.co';
                const invitedUserWithRole = await User.createUser({
                    email: userWithRoleEmail
                } as Partial<IUser>);
                mockUserAuthRequest(invitedUserWithRole);

                token = (await Organization.addMembershipInvite(organization._id!, user, userWithRoleEmail)).token;

                const addRoleSpy = jest.spyOn(Organization, 'setUserRole').mockImplementation(jest.fn(() => Promise.resolve()));
                await agent.post(`/organization/${organization.id}/invite/accept/?token=${token}`).expect(200);
                expect(Organization.setUserRole).toHaveBeenCalledTimes(0);
                addRoleSpy.mockRestore();
            });
        });
    });
});
