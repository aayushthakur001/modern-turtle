import type { IOrganizationMembership, IUserDoc } from '../../user.model';
import type { NestedRoleAssignmentPluginOptions, RoleAssignmentPluginSubEntityOptions } from './role-assignment-nested';
import type { Types, Document } from 'mongoose';
import { ResponseError } from '../../../services/utils/error.utils';
import _ from 'lodash';

export function getUserTeamIds(user: IUserDoc): Types.ObjectId[] {
    if (!user.organizationMemberships) return [];

    return (
        _.union(
            ...user.organizationMemberships.map((membership: IOrganizationMembership) => {
                return membership.teams;
            })
        ) ?? []
    );
}

export function validateRoleExists(role: string, roleList: string[]): void {
    if (!roleList || !roleList.includes(role)) {
        throw new ResponseError('NotFound');
    }
}

// SubEntities Helpers
export function getNestedOptions(options: NestedRoleAssignmentPluginOptions, subEntityField: string): RoleAssignmentPluginSubEntityOptions {
    return options.controlledNestedEntities.filter((options: RoleAssignmentPluginSubEntityOptions) => options.field === subEntityField)[0]!;
}

export function getControlledDocument(object: Document<any>, subEntityField: string, subEntityId: string): Document<any> {
    return subEntityField ? _.get(object, subEntityField).filter((subEntity: any) => subEntity._id?.equals(subEntityId))[0] : object;
}
