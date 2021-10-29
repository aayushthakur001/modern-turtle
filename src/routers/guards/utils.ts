import type { Request, Response, NextFunction } from 'express';
import type { RestrictedModel } from '../../models/plugins/role-assignment/role-assignment';
import type { IModelGovernance } from '../../models/organization-models-access-control';
import type { ModelWithRestrictedNestedEntities } from '../../models/plugins/role-assignment/role-assignment-nested';

export function createGuard<PermissionType extends string, RoleType extends string>(
    governance: IModelGovernance<PermissionType, RoleType>,
    model: RestrictedModel<RoleType>,
    modelIdReqFieldName: string
) {
    // this function creates a middleware to control(/auth) objects by organization user structure (users that belongs to organizations and teams)
    return (permission?: PermissionType): ((req: Request, res: Response, next: NextFunction) => Promise<void>) => {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            const { [modelIdReqFieldName]: id } = req.params;
            const possibleRoles = permission ? governance.getPermissionToRoles()[permission] : undefined;
            if (await model.isAuthorized(id!, possibleRoles, req.user!)) {
                next();
            } else {
                const message = 'Please contact the organization administrator!'; // doesn't reveal if this organization id exists or not
                res.status(403).json({ error: 'forbidden', message });
            }
        };
    };
}

export function createNestedGuard<PermissionType extends string, RoleType extends string, NestedField extends string>(
    governance: IModelGovernance<PermissionType, RoleType>,
    hostModel: ModelWithRestrictedNestedEntities<NestedField, RoleType>,
    hostModelIdReqFieldName: string,
    nestedEntityFieldNameInHostModel: NestedField,
    modelIdReqFieldName: string
) {
    // this function creates a middleware to control(/auth) 'Nested Objects' which are sub documents of a hostModel
    return (permission?: PermissionType): ((req: Request, res: Response, next: NextFunction) => Promise<void>) => {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            const { [hostModelIdReqFieldName]: hostId, [modelIdReqFieldName]: modelId } = req.params;
            const possibleRoles = permission ? governance.getPermissionToRoles()[permission] : undefined;
            if (await hostModel.isAuthorizedNestedDoc(hostId!, nestedEntityFieldNameInHostModel, modelId!, possibleRoles, req.user!)) {
                next();
            } else {
                const message = 'Please contact the organization administrator!'; // doesn't reveal if this organization id exists or not
                res.status(403).json({ error: 'Forbidden', message });
            }
        };
    };
}
