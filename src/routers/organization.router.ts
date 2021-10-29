import express from 'express';
import { organizationGuard, projectGroupGuard, teamGuard, registeredThemeGuard } from './guards/organization';
import { isLoggedIn, isAdmin } from './guards/user';
import * as Routes from './routes/organization.routes';
import {
    ORGANIZATION_PERMISSIONS,
    TEAM_PERMISSIONS,
    PROJECT_GROUP_PERMISSIONS,
    REGISTERED_THEME_PERMISSIONS
} from '../models/organization-models-access-control';
const { EDIT_ORGANIZATION, DELETE_ORGANIZATION, EDIT_MEMBERSHIP, CREATE_TEAM, CREATE_PROJECT_GROUP, CREATE_REGISTERED_THEME } =
    ORGANIZATION_PERMISSIONS;
const { EDIT_TEAM, DELETE_TEAM, EDIT_TEAM_MEMBERSHIP } = TEAM_PERMISSIONS;
const { EDIT_PROJECT_GROUP, DELETE_PROJECT_GROUP } = PROJECT_GROUP_PERMISSIONS;
const { EDIT_REGISTERED_THEME, DELETE_REGISTERED_THEME } = REGISTERED_THEME_PERMISSIONS;

const router = express.Router();

router.get('/list', isLoggedIn, Routes.getOrganizationList);
router.get('/:id', isLoggedIn, organizationGuard(), Routes.getOrganization);
router.post('/', isLoggedIn, isAdmin, Routes.createOrganization);
router.patch('/:id', isLoggedIn, organizationGuard(EDIT_ORGANIZATION), Routes.updateOrganization);
router.delete('/:id', isLoggedIn, organizationGuard(DELETE_ORGANIZATION), Routes.deleteOrganization);

router.get('/:id/projects', isLoggedIn, organizationGuard(), Routes.getProjectList);

router.get('/:id/user/list', isLoggedIn, organizationGuard(EDIT_MEMBERSHIP), Routes.getOrganizationUserList);
router.put('/:id/user/:userId/', isLoggedIn, organizationGuard(EDIT_MEMBERSHIP), Routes.addUserToOrganization);
router.delete('/:id/user/:userId/', isLoggedIn, organizationGuard(EDIT_MEMBERSHIP), Routes.removeUserFromOrganization);
router.post('/:id/invite/send/', isLoggedIn, organizationGuard(EDIT_MEMBERSHIP), Routes.addInvite);
router.delete('/:id/invite/delete/:inviteId', isLoggedIn, organizationGuard(EDIT_MEMBERSHIP), Routes.removeInvite);
router.post('/:id/invite/accept/', isLoggedIn, Routes.acceptInvite);

router.get('/:id/team/list', isLoggedIn, organizationGuard(), Routes.getOrganizationMemberships);
router.post('/:id/team/', isLoggedIn, organizationGuard(CREATE_TEAM), Routes.createOrganizationTeam);
router.put('/:id/team/:teamId/user/:userId/', isLoggedIn, teamGuard(EDIT_TEAM_MEMBERSHIP), Routes.addUserToOrganizationTeam);
router.delete('/:id/team/:teamId/user/:userId/', isLoggedIn, teamGuard(EDIT_TEAM_MEMBERSHIP), Routes.removeUserFromOrganizationTeam);
router.patch('/:id/team/:teamId', isLoggedIn, teamGuard(EDIT_TEAM), Routes.updateOrganizationTeam);
router.delete('/:id/team/:teamId', isLoggedIn, teamGuard(DELETE_TEAM), Routes.deleteOrganizationTeam);

router.get('/:id/projectgroups', isLoggedIn, organizationGuard(), Routes.getProjectGroups);
router.post('/:id/projectgroup', isLoggedIn, organizationGuard(CREATE_PROJECT_GROUP), Routes.createProjectGroup);
router.patch('/:id/projectgroup/:projectGroupId', isLoggedIn, projectGroupGuard(EDIT_PROJECT_GROUP), Routes.updateProjectGroup);
router.delete('/:id/projectgroup/:projectGroupId', isLoggedIn, projectGroupGuard(DELETE_PROJECT_GROUP), Routes.removeProjectGroup);

router.get('/:id/registered-themes', isLoggedIn, registeredThemeGuard(), Routes.getRegisteredThemes);
router.post('/:id/registered-themes', isLoggedIn, organizationGuard(CREATE_REGISTERED_THEME), Routes.createRegisteredTheme);
router.patch('/:id/registered-themes/:registeredThemeId', isLoggedIn, registeredThemeGuard(EDIT_REGISTERED_THEME), Routes.updateRegisteredTheme);
router.delete('/:id/registered-themes/:registeredThemeId', isLoggedIn, registeredThemeGuard(DELETE_REGISTERED_THEME), Routes.removeRegisteredTheme);

module.exports = router;
