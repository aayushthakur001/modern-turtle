import type { IOrganizationMembership, IUserDoc } from './user.model';

// Interface and utils for organization access control
export interface IModelGovernance<PermissionType extends string, RoleType extends string> {
    getRoles: () => RoleType[];
    getPermissionToRoles: () => Record<PermissionType, RoleType[]>;
}

function convertRolePermissionsToPermissionRolesMappers<PermissionType extends string, RoleType extends string>(
    rolePermissions: Record<RoleType, PermissionType[]>
) {
    const permissionRoles = {} as Record<PermissionType, RoleType[]>;
    for (const roleName in rolePermissions) {
        const role = roleName as RoleType;
        for (const permission of rolePermissions[role]) {
            // permissionList?.forEach((permission: PermissionType) => {
            permissionRoles[permission] = [...(permissionRoles[permission] ?? []), role];
        }
    }
    return permissionRoles as Record<PermissionType, RoleType[]>;
}

export function createModelGovernance<PermissionType extends string, RoleType extends string>(
    rolePermissions: Record<RoleType, PermissionType[]>
): IModelGovernance<PermissionType, RoleType> {
    return {
        getRoles: () => Object.keys(rolePermissions) as RoleType[],
        getPermissionToRoles: () => convertRolePermissionsToPermissionRolesMappers<PermissionType, RoleType>(rolePermissions)
    } as IModelGovernance<PermissionType, RoleType>;
}

// Organization model implementation
export const doUserHaveAtLeastDefaultOrganizationAccessRole = async (user: IUserDoc, objectId: string): Promise<boolean> => {
    if (!user.organizationMemberships) return false;

    // member user of this organization would be granted with at least default role
    return user.organizationMemberships.some((membership: IOrganizationMembership) => membership.organizationId.equals(objectId));
};

export const ORGANIZATION_PERMISSIONS = {
    // Organization Admin
    EDIT_ORGANIZATION: 'EDIT_ORGANIZATION',
    DELETE_ORGANIZATION: 'DELETE_ORGANIZATION',
    EDIT_MEMBERSHIP: 'EDIT_MEMBERSHIP',
    // Can create sub entities
    CREATE_TEAM: 'CREATE_TEAM',
    CREATE_PROJECT_GROUP: 'CREATE_PROJECT_GROUP',
    CREATE_REGISTERED_THEME: 'CREATE_REGISTERED_THEME'
} as const;

export const ORGANIZATION_ROLES = {
    ORG_ADMIN: 'ORG_ADMIN',
    ORG_FULL_ADMIN: 'ORG_FULL_ADMIN'
} as const;

export type OrganizationPermission = keyof typeof ORGANIZATION_PERMISSIONS;
export type OrganizationRole = keyof typeof ORGANIZATION_ROLES;

const ORGANIZATION_ROLE_PERMISSIONS = {} as Record<OrganizationRole, OrganizationPermission[]>;
ORGANIZATION_ROLE_PERMISSIONS[ORGANIZATION_ROLES.ORG_ADMIN] = Object.values(ORGANIZATION_PERMISSIONS); // all the permissions
ORGANIZATION_ROLE_PERMISSIONS[ORGANIZATION_ROLES.ORG_FULL_ADMIN] = Object.values(ORGANIZATION_PERMISSIONS); // all the permissions

export const OrganizationAccessControl = createModelGovernance<OrganizationPermission, OrganizationRole>(ORGANIZATION_ROLE_PERMISSIONS);

export const ORGANIZATION_NESTED_ENTITY_FIELDS = {
    teams: 'teams',
    projectGroups: 'projectGroups',
    registeredThemes: 'registeredThemes'
} as const;

export type OrganizationNestedEntityFields = keyof typeof ORGANIZATION_NESTED_ENTITY_FIELDS;

// Team model implementation
export const TEAM_PERMISSIONS = {
    EDIT_TEAM: 'EDIT_TEAM',
    DELETE_TEAM: 'DELETE_TEAM',
    EDIT_TEAM_MEMBERSHIP: 'EDIT_TEAM_MEMBERSHIP'
} as const;

export const TEAM_ROLES = {
    TEAM_ADMIN: 'TEAM_ADMIN'
} as const;

export type TeamPermission = keyof typeof TEAM_PERMISSIONS;
export type TeamRole = keyof typeof TEAM_ROLES;

const TEAM_ROLE_PERMISSIONS = {} as Record<TeamRole, TeamPermission[]>;
TEAM_ROLE_PERMISSIONS[TEAM_ROLES.TEAM_ADMIN] = Object.values(TEAM_PERMISSIONS); // all the permissions

export const TeamAccessControl = createModelGovernance<TeamPermission, TeamRole>(TEAM_ROLE_PERMISSIONS);

// ProjectGroup model implementation
export const PROJECT_GROUP_PERMISSIONS = {
    EDIT_PROJECT_GROUP: 'EDIT_PROJECT_GROUP',
    DELETE_PROJECT_GROUP: 'DELETE_PROJECT_GROUP',
    ASSIGN_GROUP_ADMIN: 'ASSIGN_GROUP_ADMIN'
} as const;

export const PROJECT_GROUP_ROLES = {
    PROJECT_GROUP_ADMIN: 'PROJECT_GROUP_ADMIN'
} as const;

export type ProjectGroupPermission = keyof typeof PROJECT_GROUP_PERMISSIONS;
export type ProjectGroupRole = keyof typeof PROJECT_GROUP_ROLES;

const PROJECT_GROUP_ROLE_PERMISSIONS = {} as Record<ProjectGroupRole, ProjectGroupPermission[]>;
PROJECT_GROUP_ROLE_PERMISSIONS[PROJECT_GROUP_ROLES.PROJECT_GROUP_ADMIN] = Object.values(PROJECT_GROUP_PERMISSIONS); // all the permissions

export const ProjectGroupAccessControl = createModelGovernance<ProjectGroupPermission, ProjectGroupRole>(PROJECT_GROUP_ROLE_PERMISSIONS);

// ProjectGroup model implementation
export const REGISTERED_THEME_PERMISSIONS = {
    EDIT_REGISTERED_THEME: 'EDIT_REGISTERED_THEME',
    DELETE_REGISTERED_THEME: 'DELETE_REGISTERED_THEME',
    ASSIGN_THEME_ADMIN: 'ASSIGN_THEME_ADMIN'
} as const;

export const REGISTERED_THEME_ROLES = {
    REGISTERED_THEME_ADMIN: 'REGISTERED_THEME_ADMIN'
} as const;

export type RegisteredThemePermission = keyof typeof REGISTERED_THEME_PERMISSIONS;
export type RegisteredThemeRole = keyof typeof REGISTERED_THEME_ROLES;

const REGISTERED_THEME_ROLE_PERMISSIONS = {} as Record<RegisteredThemeRole, RegisteredThemePermission[]>;
REGISTERED_THEME_ROLE_PERMISSIONS[REGISTERED_THEME_ROLES.REGISTERED_THEME_ADMIN] = Object.values(REGISTERED_THEME_PERMISSIONS); // all the permissions

export const RegisteredThemeAccessControl = createModelGovernance<RegisteredThemePermission, RegisteredThemeRole>(
    REGISTERED_THEME_ROLE_PERMISSIONS
);
