import type * as mongooseType from 'mongoose';
import type { default as OrganizationType, IOrganization } from './organization.model';
import type { IRegisteredTheme } from './organization.registered-themes.submodel';
import type { default as UserType } from './user.model';
import { connectToDatabase, clearDatabase, closeDatabase } from '../test-utils/mongo';
import { createOrganizationTeamUserPreset, loadOrganization, organizationTestConfig } from '../test-utils/organization';
import { loadCommonRequireMock } from '../test-utils/requireMock';
import { loadUser } from '../test-utils/user';
import { ORGANIZATION_NESTED_ENTITY_FIELDS, REGISTERED_THEME_ROLES } from './organization-models-access-control';

describe('Organization RegisteredThemes SubModel', () => {
    let Organization: typeof OrganizationType;
    let User: typeof UserType;
    let mongoose: typeof mongooseType;
    const validRegisteredThemeMockData = { name: 'test project', repoUrl: 'https://github.com/lwz7512/next-smooth-doc' };

    beforeAll(async () => {
        jest.resetModules();
        mongoose = require('mongoose');
        await connectToDatabase(mongoose);
        loadCommonRequireMock(jest, { ...organizationTestConfig });
        User = loadUser();
        Organization = loadOrganization();
    });

    beforeEach(() => {
        return clearDatabase(mongoose);
    });

    afterAll(() => {
        closeDatabase(mongoose);
    });

    test('statics.createRegisteredTheme', async () => {
        const createdOrganization = await Organization.createOrganization({
            name: 'org'
        } as IOrganization);
        const organization = await Organization.createRegisteredTheme(createdOrganization._id!, validRegisteredThemeMockData);
        expect(organization!.registeredThemes).toHaveLength(1);

        const newRegisteredTheme = (await organization!.getRegisteredThemes())![0]!;
        expect(newRegisteredTheme!.name).toBe(validRegisteredThemeMockData.name);
        expect(newRegisteredTheme!.repoUrl).toBe(validRegisteredThemeMockData.repoUrl);

        // organization id is not correct
        const wrongOrgIdRegisteredTheme = await Organization.createRegisteredTheme(
            new mongoose.Types.ObjectId(),
            validRegisteredThemeMockData
        );
        expect(wrongOrgIdRegisteredTheme).toBeNull();
    });

    test('static.updateRegisteredTheme', async () => {
        const newId = new mongoose.Types.ObjectId();
        let validRegisteredThemeMockData = { name: 'test project', repoUrl: 'https://github.com/lwz7512/next-smooth-doc' };
        let org = await Organization.createOrganization({
            name: 'org'
        } as IOrganization);
        const organization = await Organization.createRegisteredTheme(org._id!, { ...validRegisteredThemeMockData });
        const createdRegisteredTheme = (await organization!.getRegisteredThemes())![0]!;

        let updatedOrganization = await Organization.updateRegisteredTheme(
            newId,
            createdRegisteredTheme._id!,
            validRegisteredThemeMockData
        );
        expect(updatedOrganization).toBeNull();

        updatedOrganization = await Organization.updateRegisteredTheme(org._id!, newId, validRegisteredThemeMockData);
        expect(updatedOrganization).toBeNull();

        const updatedOrg = await Organization.updateRegisteredTheme(org._id!, createdRegisteredTheme._id!, {
            name: 'newName',
            id: newId
        } as unknown as IRegisteredTheme);
        expect(updatedOrg!.registeredThemes![0]!._id!).toStrictEqual(createdRegisteredTheme._id!); // ignoring non updatable fields in update

        validRegisteredThemeMockData = {
            name: 'FreshNewName',
            repoUrl: 'https://github.com/lwz7512/next-smooth-doc'
        };
        updatedOrganization = await Organization.updateRegisteredTheme(org._id!, createdRegisteredTheme._id!, validRegisteredThemeMockData);
        org = (await Organization.getOrganization(updatedOrganization!._id!))!;
        const updatedRegisteredTheme = (await org!.getRegisteredThemes())![0]!;
        expect(updatedRegisteredTheme.name!).toStrictEqual(validRegisteredThemeMockData.name);
    });

    test('static.deleteRegisteredTheme', async () => {
        const org = await Organization.createOrganization({
            name: 'org'
        } as IOrganization);
        const organization = await Organization.createRegisteredTheme(org._id!, { ...validRegisteredThemeMockData });
        const createdRegisteredTheme = (await organization!.getRegisteredThemes())![0]!;

        // check if project group was deleted
        await Organization.deleteRegisteredTheme(org._id!, createdRegisteredTheme!._id!);
        const fetchedOrg = (await Organization.getOrganization(org._id!))!;
        const orgRegThemes = (await fetchedOrg!.getRegisteredThemes())!;
        expect(orgRegThemes).toHaveLength(0);
    });

    describe('Access Control List', () => {
        let preset: Record<string, any>;
        const { registeredThemes } = ORGANIZATION_NESTED_ENTITY_FIELDS;
        beforeEach(async () => {
            const { user, org, team } = await createOrganizationTeamUserPreset(User, Organization);
            const organization = await Organization.createRegisteredTheme(org._id!, validRegisteredThemeMockData);
            const createdRegisteredTheme = (await organization!.getRegisteredThemes())![0]!;
            preset = { user, org, team, registeredTheme: createdRegisteredTheme };
        });
        test('statics.isAuthorized non organization user', async () => {
            const { user, org, registeredTheme } = preset;
            const nonOrganizationUser = await User.createUser({
                displayName: 'user',
                email: 'user@user.co'
            });
            expect(
                await Organization.isAuthorizedNestedDoc(org.id!, registeredThemes, registeredTheme.id!, undefined, nonOrganizationUser)
            ).toBeFalsy();
            expect(
                await Organization.isAuthorizedNestedDoc(
                    org.id!,
                    registeredThemes,
                    registeredTheme.id!,
                    [REGISTERED_THEME_ROLES.REGISTERED_THEME_ADMIN],
                    user
                )
            ).toBeFalsy();
        });
        test('statics.isAuthorized organization user without role', async () => {
            const { user, org, registeredTheme } = preset;
            expect(await Organization.isAuthorizedNestedDoc(org.id!, registeredThemes, registeredTheme.id!, undefined, user)).toBeTruthy();
            expect(
                await Organization.isAuthorizedNestedDoc(
                    org.id!,
                    registeredThemes,
                    registeredTheme.id!,
                    [REGISTERED_THEME_ROLES.REGISTERED_THEME_ADMIN],
                    user
                )
            ).toBeFalsy();
        });
        test('statics.isAuthorized by user role', async () => {
            const { user, org, registeredTheme } = preset;

            await Organization.setNestedUserRole(
                org.id!,
                registeredThemes,
                registeredTheme.id!,
                REGISTERED_THEME_ROLES.REGISTERED_THEME_ADMIN,
                user._id!
            );
            expect(
                await Organization.isAuthorizedNestedDoc(
                    org.id!,
                    registeredThemes,
                    registeredTheme.id!,
                    [REGISTERED_THEME_ROLES.REGISTERED_THEME_ADMIN],
                    user
                )
            ).toBeTruthy();

            await Organization.removeNestedUserRole(org.id!, registeredThemes, registeredTheme.id!, user._id!);
            expect(
                await Organization.isAuthorizedNestedDoc(
                    org.id!,
                    registeredThemes,
                    registeredTheme.id!,
                    [REGISTERED_THEME_ROLES.REGISTERED_THEME_ADMIN],
                    user
                )
            ).toBeFalsy();
        });
        test('statics.isAuthorized by team role', async () => {
            const { user, team, org, registeredTheme } = preset;

            await Organization.setNestedTeamRole(
                org.id!,
                registeredThemes,
                registeredTheme.id!,
                REGISTERED_THEME_ROLES.REGISTERED_THEME_ADMIN,
                team._id!
            );
            expect(
                await Organization.isAuthorizedNestedDoc(
                    org.id!,
                    registeredThemes,
                    registeredTheme.id!,
                    [REGISTERED_THEME_ROLES.REGISTERED_THEME_ADMIN],
                    user
                )
            ).toBeTruthy();

            await Organization.removeNestedTeamRole(org.id!, registeredThemes, registeredTheme.id!, team._id!);
            expect(
                await Organization.isAuthorizedNestedDoc(
                    org.id!,
                    registeredThemes,
                    registeredTheme.id!,
                    [REGISTERED_THEME_ROLES.REGISTERED_THEME_ADMIN],
                    user
                )
            ).toBeFalsy();
        });
    });
});
