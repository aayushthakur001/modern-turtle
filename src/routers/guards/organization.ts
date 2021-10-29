import {
    OrganizationAccessControl,
    OrganizationPermission,
    OrganizationRole,
    TeamAccessControl,
    TeamPermission,
    TeamRole,
    ProjectGroupAccessControl,
    ProjectGroupPermission,
    ProjectGroupRole,
    RegisteredThemeAccessControl,
    RegisteredThemePermission,
    RegisteredThemeRole
} from '../../models/organization-models-access-control';
import Organization from '../../models/organization.model';
import { createGuard, createNestedGuard } from './utils';

export const organizationGuard = createGuard<OrganizationPermission, OrganizationRole>(OrganizationAccessControl, Organization, 'id');

const teamsKey = { teams: 'teams' } as const;
export const teamGuard = createNestedGuard<TeamPermission, TeamRole, keyof typeof teamsKey>(
    TeamAccessControl,
    Organization,
    'id',
    teamsKey.teams,
    'teamId'
);

const projectGroupsKey = { projectGroups: 'projectGroups' } as const;
export const projectGroupGuard = createNestedGuard<ProjectGroupPermission, ProjectGroupRole, keyof typeof projectGroupsKey>(
    ProjectGroupAccessControl,
    Organization,
    'id',
    projectGroupsKey.projectGroups,
    'projectGroupId'
);

const registeredThemesKey = { registeredThemes: 'registeredThemes' } as const;
export const registeredThemeGuard = createNestedGuard<RegisteredThemePermission, RegisteredThemeRole, keyof typeof registeredThemesKey>(
    RegisteredThemeAccessControl,
    Organization,
    'id',
    registeredThemesKey.registeredThemes,
    'registeredThemeId'
);
