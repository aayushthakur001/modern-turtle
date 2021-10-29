// Role-Assignment-plugin extention to control nested document autorization
// Plugin supports nested controlled objects, meaning it support ACL on model level (i.e organization) and it's subEntity which is a list of documents that controlled in the context of the model (teams, projectGroups, themes of specific organization)

import { Schema, Types } from 'mongoose';
import _ from 'lodash';
import type { IUserDoc } from '../../user.model';
import { validateRoleExists, getControlledDocument, getUserTeamIds, getNestedOptions } from './role-assignment.utils';
import { ResponseError } from '../../../services/utils/error.utils';
import { IRoleAssignmentDoc, RoleAssignmentPluginOptions, RoleAssignmentSchema } from './role-assignment';

export interface RestrictedNestedModel {
    accessControlList?: IRoleAssignmentDoc[];
}

export interface ModelWithRestrictedNestedEntities<SubEntityFieldType, SubEntityRoleType> {
    setNestedUserRole(
        hostEntityModelId: string,
        subEntityFieldName: SubEntityFieldType,
        objectId: string,
        role: SubEntityRoleType,
        userId: Types.ObjectId
    ): Promise<void>;
    removeNestedUserRole(
        hostEntityModelId: string,
        subEntityFieldName: SubEntityFieldType,
        objectId: string,
        userId: Types.ObjectId
    ): Promise<void>;
    setNestedTeamRole(
        hostEntityModelId: string,
        subEntityFieldName: SubEntityFieldType,
        objectId: string,
        role: SubEntityRoleType,
        teamId: Types.ObjectId
    ): Promise<void>;
    removeNestedTeamRole(
        hostEntityModelId: string,
        subEntityFieldName: SubEntityFieldType,
        objectId: string,
        teamId: Types.ObjectId
    ): Promise<void>;
    isAuthorizedNestedDoc(
        hostEntityModelId: string,
        subEntityFieldName: SubEntityFieldType,
        objectId: string,
        possibleRoles: SubEntityRoleType[] | undefined,
        user: IUserDoc
    ): Promise<boolean>;
}

export interface RoleAssignmentPluginSubEntityOptions extends RoleAssignmentPluginOptions {
    field: string;
    schema: Schema;
}

export interface NestedRoleAssignmentPluginOptions {
    controlledNestedEntities: RoleAssignmentPluginSubEntityOptions[];
}

export function NestedRoleAssignmentPlugin(schema: Schema, options: NestedRoleAssignmentPluginOptions): void {
    options = options || {};
    options.controlledNestedEntities?.forEach((subEntity) => {
        subEntity.schema.add({ accessControlList: [RoleAssignmentSchema] });
        schema.index({ [`${subEntity.field}.accessControlList.userId`]: 1 });
        schema.index({ [`${subEntity.field}.accessControlList.teamId`]: 1 });
    });

    schema.statics.setNestedUserRole = async function (hostEntityModelId, subEntityFieldName, objectId, role, userId) {
        const nestedOptions = getNestedOptions(options, subEntityFieldName);
        validateRoleExists(role, nestedOptions.roleList);
        const object = await this.findOne({ _id: hostEntityModelId });
        if (!object) {
            throw new ResponseError('NotFound');
        }

        // update controlledDocument (model / subModel): add new record to ACL
        const controlledDocument = getControlledDocument(object, subEntityFieldName, objectId);
        _.set(controlledDocument, 'accessControlList', [
            ..._.get(controlledDocument, 'accessControlList').filter(
                (roleAssignment: IRoleAssignmentDoc) => !roleAssignment.userId?.equals(userId)
            ),
            { userId, role }
        ]);

        await object.save();
    };

    schema.statics.removeNestedUserRole = async function (hostEntityModelId, subEntityFieldName, objectId, userId) {
        const object = await this.findOne({ _id: hostEntityModelId });
        if (!object) {
            throw new ResponseError('NotFound');
        }

        // update controlledDocument (model / subModel) remove user role from ACL
        const controlledDocument = getControlledDocument(object, subEntityFieldName, objectId);
        _.set(controlledDocument, 'accessControlList', [
            ..._.get(controlledDocument, 'accessControlList').filter(
                (roleAssignment: IRoleAssignmentDoc) => !roleAssignment.userId?.equals(userId)
            )
        ]);

        await object.save();
    };

    schema.statics.setNestedTeamRole = async function (hostEntityModelId, subEntityFieldName, objectId, role, teamId) {
        const nestedOptions = getNestedOptions(options, subEntityFieldName);
        validateRoleExists(role, nestedOptions.roleList);

        const object = await this.findOne({ _id: hostEntityModelId });
        if (!object) {
            throw new ResponseError('NotFound');
        }

        // update controlledDocument (model / subModel): add new team role to ACL
        const controlledDocument = getControlledDocument(object, subEntityFieldName, objectId);
        _.set(controlledDocument, 'accessControlList', [
            ..._.get(controlledDocument, 'accessControlList').filter(
                (roleAssignment: IRoleAssignmentDoc) => !roleAssignment.teamId?.equals(teamId)
            ),
            { teamId, role }
        ]);

        await object.save();
    };

    schema.statics.removeNestedTeamRole = async function (hostEntityModelId, subEntityFieldName, objectId, teamId) {
        const object = await this.findOne({ _id: hostEntityModelId });
        if (!object) {
            throw new ResponseError('NotFound');
        }

        // update controlledDocument (model / subModel): remove team role from ACL
        const controlledDocument = getControlledDocument(object, subEntityFieldName, objectId);
        _.set(controlledDocument, 'accessControlList', [
            ..._.get(controlledDocument, 'accessControlList').filter(
                (roleAssignment: IRoleAssignmentDoc) => !roleAssignment.teamId?.equals(teamId)
            )
        ]);

        await object.save();
    };

    schema.statics.isAuthorizedNestedDoc = async function (hostEntityModelId, subEntityFieldName, objectId, possibleRoles, user) {
        const userTeamIds = getUserTeamIds(user);
        const userAffiliation = [{ userId: user._id }, { teamId: { $in: userTeamIds } }];

        // if default role required check if user has default role
        const isDefaultRoleSufficient = possibleRoles === undefined;

        const nestedOptions = getNestedOptions(options, subEntityFieldName);
        const atLeastDefaultRoleMatcher = nestedOptions.atLeastDefaultRoleMatcher;

        if (isDefaultRoleSufficient) {
            if (atLeastDefaultRoleMatcher && (await atLeastDefaultRoleMatcher(user, hostEntityModelId))) {
                return true;
            } else {
                // check if user have any role
                const foundAnyRole = await this.findOne({
                    _id: hostEntityModelId,
                    [`${subEntityFieldName}.accessControlList`]: { $elemMatch: { $or: userAffiliation } }
                });
                return !!foundAnyRole;
            }
        }
        // find role by subject(user/team) record in access control list
        const foundOne = await this.findOne({
            _id: hostEntityModelId,
            [`${subEntityFieldName}._id`]: objectId,
            [`${subEntityFieldName}.accessControlList`]: { $elemMatch: { role: { $in: possibleRoles }, $or: userAffiliation } }
        });
        return !!foundOne;
    };
}
