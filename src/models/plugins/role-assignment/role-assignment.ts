// Role-Assignment-plugin is a mongoose plugin for extending models to be 'role assignable' =>
// support defining a collection of users/teams and their roles over the model

import { Document, Schema, Types } from 'mongoose';
import { makeTypeSafeSchema } from '../../model-utils';
import _ from 'lodash';
import type { IUserDoc } from '../../user.model';
import { validateRoleExists, getUserTeamIds } from './role-assignment.utils';
import { ResponseError } from '../../../services/utils/error.utils';

export interface ISubject {
    userId?: Types.ObjectId;
    teamId?: Types.ObjectId;
}

export interface IRole {
    role: string;
}

export interface IRoleAssignment extends ISubject, IRole {}

export interface IRoleAssignmentDoc extends IRoleAssignment, Document<Types.ObjectId> {
    id?: string;
}

export type IRoleAssignmentJSON = IRoleAssignment & Pick<IRoleAssignmentDoc, 'id'>;

export const RoleAssignmentSchema = makeTypeSafeSchema(
    new Schema<IRoleAssignmentDoc>({
        userId: { type: Types.ObjectId, ref: 'User' },
        teamId: { type: Types.ObjectId, ref: 'Team' },
        role: String
    } as Record<keyof IRoleAssignment, any>)
);

export interface RoleAssignmentPluginOptions {
    roleList: string[];
    atLeastDefaultRoleMatcher?: (user: IUserDoc, objectId: Types.ObjectId) => Promise<boolean>;
}

export interface RestrictedModel<RoleType> {
    accessControlList?: IRoleAssignmentDoc[];

    // statics
    setUserRole(objectId: string, role: RoleType, userId: Types.ObjectId): Promise<void>;
    removeUserRole(objectId: string, userId: Types.ObjectId): Promise<void>;
    setTeamRole(objectId: string, role: RoleType, teamId: Types.ObjectId): Promise<void>;
    removeTeamRole(objectId: string, teamId: Types.ObjectId): Promise<void>;
    isAuthorized(objectId: string, possibleRoles: RoleType[] | undefined, user: IUserDoc): Promise<boolean>;
}

export function RoleAssignmentPlugin(schema: Schema, options: RoleAssignmentPluginOptions): void {
    options = options || {};

    schema.add({ accessControlList: [RoleAssignmentSchema] });
    schema.index({ 'accessControlList.userId': 1 });
    schema.index({ 'accessControlList.teamId': 1 });

    schema.statics.setUserRole = async function (objectId, role, userId) {
        validateRoleExists(role, options.roleList);

        const object = await this.findOne({ _id: objectId });
        if (!object) {
            throw new ResponseError('NotFound');
        }

        // update controlledDocument (model / subModel): add new record to ACL
        _.set(object, 'accessControlList', [
            ..._.get(object, 'accessControlList').filter((roleAssignment: IRoleAssignmentDoc) => !roleAssignment.userId?.equals(userId)),
            { userId, role }
        ]);

        await object.save();
    };

    schema.statics.removeUserRole = async function (objectId, userId) {
        const object = await this.findOne({ _id: objectId });
        if (!object) {
            throw new ResponseError('NotFound');
        }

        // update controlledDocument (model / subModel) remove user role from ACL
        _.set(object, 'accessControlList', [
            ..._.get(object, 'accessControlList').filter((roleAssignment: IRoleAssignmentDoc) => !roleAssignment.userId?.equals(userId))
        ]);

        await object.save();
    };

    schema.statics.setTeamRole = async function (objectId, role, teamId) {
        validateRoleExists(role, options.roleList);

        const object = await this.findOne({ _id: objectId });
        if (!object) {
            throw new ResponseError('NotFound');
        }

        // update controlledDocument (model / subModel): add new record to ACL
        _.set(object, 'accessControlList', [
            ..._.get(object, 'accessControlList').filter((roleAssignment: IRoleAssignmentDoc) => !roleAssignment.teamId?.equals(teamId)),
            { teamId, role }
        ]);

        await object.save();
    };

    schema.statics.removeTeamRole = async function (objectId, teamId) {
        const object = await this.findOne({ _id: objectId });
        if (!object) {
            throw new ResponseError('NotFound');
        }

        // update controlledDocument (model / subModel) remove user role from ACL
        _.set(object, 'accessControlList', [
            ..._.get(object, 'accessControlList').filter((roleAssignment: IRoleAssignmentDoc) => !roleAssignment.teamId?.equals(teamId))
        ]);

        await object.save();
    };

    schema.statics.isAuthorized = async function (objectId, possibleRoles, user) {
        const userTeamIds = getUserTeamIds(user);
        const userAffiliation = [{ userId: user._id }, { teamId: { $in: userTeamIds } }];

        // if default role required check if user has default role
        const isDefaultRoleSufficient = possibleRoles === undefined;

        const atLeastDefaultRoleMatcher = options.atLeastDefaultRoleMatcher;

        if (isDefaultRoleSufficient) {
            if (atLeastDefaultRoleMatcher && (await atLeastDefaultRoleMatcher(user, objectId))) {
                return true;
            } else {
                // check if user have any role
                const foundAnyRole = await this.findOne({ _id: objectId, accessControlList: { $elemMatch: { $or: userAffiliation } } });
                return !!foundAnyRole;
            }
        }

        // find role by subject(user/team) record in access control list
        const foundOne = await this.findOne({
            _id: objectId,
            accessControlList: { $elemMatch: { role: { $in: possibleRoles }, $or: userAffiliation } }
        });
        return !!foundOne;
    };
}
