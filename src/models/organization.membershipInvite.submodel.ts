import { Document, Schema, Types } from 'mongoose';
import validator from 'validator';
import uuid from 'uuid';
import { makeTypeSafeSchema, TypeSafeSchema } from './model-utils';
import type { IOrganizationDoc, IOrganizationModel } from './organization.model';
import Organization from './organization.model';
import { ResponseError } from '../services/utils/error.utils';
import logger from '../services/logger';
import { OrganizationAccessControl, OrganizationRole } from './organization-models-access-control';

export interface IMembershipInvite {
    token: string;
    email: string;
    role?: string;
}

export interface IMembershipInviteDoc extends IMembershipInvite, Document<Types.ObjectId> {
    id?: string;
}

export type IMembershipInviteJSON = IMembershipInvite & Pick<IMembershipInviteDoc, 'id'>;

export const MembershipInviteSchema = makeTypeSafeSchema(
    new Schema<IMembershipInviteDoc>({
        token: { type: String, required: true },
        email: { type: String, required: true },
        role: { type: String }
    } as Record<keyof IMembershipInvite, any>)
);

// Register invite related methods
export const registerOrganizationInviteFunctions = (
    OrganizationSchema: TypeSafeSchema<IOrganizationDoc, IOrganizationModel, Types.ObjectId>
): void => {
    OrganizationSchema.statics.addMembershipInvite = async function (id, user, email, role) {
        const token = uuid();

        if (!email || !validator.isEmail(email)) {
            throw new ResponseError('InvalidEmailAddress');
        }

        if (role && !OrganizationAccessControl.getRoles().includes(role)) {
            throw new ResponseError('InvalidRole');
        }

        logger.debug('addRoleUserInvite', { id, token, email, role, invitedByUserId: user.id });

        // remove existing invites
        await Organization.findOneAndUpdate(
            { _id: id },
            {
                $pull: { membershipInvites: { email } }
            },
            { new: true }
        );

        const invite = { token, email } as IMembershipInviteDoc;
        if (role) {
            invite.role = role;
        }

        const newOrganization = await Organization.findOneAndUpdate(
            { _id: id },
            {
                $addToSet: { membershipInvites: invite }
            },
            { new: true }
        );

        if (!newOrganization) {
            throw new ResponseError('NotFound');
        }

        return { organization: newOrganization, token };
    };

    OrganizationSchema.statics.acceptMembershipInvite = async function (id, user, token) {
        const organization = await Organization.findOne({ _id: id });
        if (!organization) {
            throw new ResponseError('NotFound');
        }
        const invites = organization.membershipInvites?.filter((invite) => invite.token === token);

        if (!(invites?.length === 1)) {
            throw new ResponseError('NotFound');
        }

        const invite = invites[0]!;

        if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
            throw new ResponseError('OrganizationAcceptInviteWithDifferentEmailAddress');
        }

        const role = invite.role!;

        logger.debug('acceptMembershipInvite', { invite, inviteeUserId: user.id, organizationId: organization.id });

        const existingMemberships = user.organizationMemberships?.filter((membership) => membership.organizationId.equals(id));

        if (existingMemberships?.length && existingMemberships.some((membership) => membership.organizationId.equals(id))) {
            if (await Organization.isAuthorized(organization.id!, [role as OrganizationRole], user)) {
                throw new ResponseError('OrganizationRoleAlreadyExists');
            }
        } else {
            await Organization.addUser(id, user._id!);
        }

        if (role) {
            await Organization.setUserRole(organization.id!, role as OrganizationRole, user._id!);
        }
        const newOrganization = await Organization.findOneAndUpdate(
            { _id: id },
            {
                $pull: { membershipInvites: { token } }
            },
            { new: true }
        );

        return newOrganization!;
    };

    OrganizationSchema.statics.removeMembershipInvite = async function (id, user, inviteId) {
        const organization = await Organization.findOne({ _id: id });
        if (!organization) {
            throw new ResponseError('NotFound');
        }
        const invites = organization.membershipInvites?.filter((invite) => invite?.id === inviteId);

        if (!(invites?.length === 1)) {
            throw new ResponseError('NotFound');
        }

        const invite = invites[0]!;

        logger.debug('removeMembershipInvite', { invite, removedByUserId: user.id, organizationId: organization.id });

        const newOrganization = await Organization.findOneAndUpdate(
            { _id: id },
            {
                $pull: { membershipInvites: { _id: Types.ObjectId(inviteId) } }
            },
            { new: true }
        );

        return newOrganization!;
    };
};
