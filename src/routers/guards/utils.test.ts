import { createGuard, createNestedGuard } from './utils';
import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

describe('router.utils', () => {
    describe('OrganizationUserPermission functions', () => {
        const orgId = mongoose.Types.ObjectId();
        const req = {
            params: {
                id: orgId
            },
            user: {}
        };
        const roles = { specificRole: 'specificRole', role2: 'role2', role3: 'role3' } as const;
        const permissions = { specificPermission: 'specificPermission', perm2: 'perm2', perm3: 'perm3' } as const;
        const governance = {
            getPermissionToRoles: () => {
                return {
                    [permissions.specificPermission]: [roles.specificRole],
                    [permissions.perm2]: [roles.role2, roles.role3],
                    [permissions.perm3]: [roles.role3]
                };
            },
            getRoles: () => {
                return Object.values(roles);
            }
        };
        describe('createGuard', () => {
            const json = jest.fn();
            const res = {
                status: jest.fn().mockReturnValue({ json })
            };
            const next = jest.fn();
            const Model = {
                isAuthorized: jest.fn().mockReturnValue(false),
                setUserRole: jest.fn(),
                removeUserRole: jest.fn(),
                setTeamRole: jest.fn(),
                removeTeamRole: jest.fn()
            };
            const modelGuard = createGuard<keyof typeof permissions, keyof typeof roles>(governance, Model, 'id');

            test('modelGuard(permissions.specificPermission) fails when isAuthorized return false', async () => {
                await modelGuard(permissions.specificPermission)(
                    req as unknown as Request,
                    res as unknown as Response,
                    next as NextFunction
                );
                expect(next.mock.calls).toHaveLength(0);
                expect(res.status.mock.calls).toHaveLength(1);
                expect(res.status.mock.calls[0][0]).toBe(403);
            });

            test('modelGuard(permissions.specificPermission) success when isAuthorized returns true', async () => {
                Model.isAuthorized.mockReturnValue(true);
                await modelGuard(permissions.specificPermission)(
                    req as unknown as Request,
                    res as unknown as Response,
                    next as NextFunction
                );
                expect(next.mock.calls).toHaveLength(1);
            });

            test('modelGuard(permissions.specificPermission) mapping permission to possible role list', async () => {
                for (const perm of Object.values(permissions)) {
                    await modelGuard(perm)(req as unknown as Request, res as unknown as Response, next as NextFunction);
                    const expectedPermRoles = governance.getPermissionToRoles()[perm];
                    const isAuthCall = Model.isAuthorized.mock.calls[Model.isAuthorized.mock.calls.length - 1];
                    const argRoleList = isAuthCall[1];
                    expect(argRoleList.sort()).toEqual(expectedPermRoles.sort());
                }
            });
        });

        describe('createNestedGuard', () => {
            const json = jest.fn();
            const res = {
                status: jest.fn().mockReturnValue({ json })
            };
            const next = jest.fn();
            const HostModel = {
                isAuthorizedNestedDoc: jest.fn().mockReturnValue(false),
                setNestedUserRole: jest.fn(),
                removeNestedUserRole: jest.fn(),
                setNestedTeamRole: jest.fn(),
                removeNestedTeamRole: jest.fn()
            };
            const modelsType = { models: 'models' } as const;
            const subModelGuard = createNestedGuard<keyof typeof permissions, keyof typeof roles, keyof typeof modelsType>(
                governance,
                HostModel,
                'id',
                'models',
                'nestedModelId'
            );

            test('subModelGuard(permissions.specificPermission) fails when isAuthorized return false', async () => {
                await subModelGuard(permissions.specificPermission)(
                    req as unknown as Request,
                    res as unknown as Response,
                    next as NextFunction
                );
                expect(next.mock.calls).toHaveLength(0);
                expect(res.status.mock.calls).toHaveLength(1);
                expect(res.status.mock.calls[0][0]).toBe(403);
            });

            test('subModelGuard(permissions.specificPermission) success when isAuthorized returns true', async () => {
                HostModel.isAuthorizedNestedDoc.mockReturnValue(true);
                await subModelGuard(permissions.specificPermission)(
                    req as unknown as Request,
                    res as unknown as Response,
                    next as NextFunction
                );
                expect(next.mock.calls).toHaveLength(1);
            });

            test('subModelGuard(permissions.specificPermission) mapping permission to possible role list', async () => {
                for (const perm of Object.values(permissions)) {
                    await subModelGuard(perm)(req as unknown as Request, res as unknown as Response, next as NextFunction);
                    const expectedPermRoles = governance.getPermissionToRoles()[perm];
                    const isAuthCall = HostModel.isAuthorizedNestedDoc.mock.calls[HostModel.isAuthorizedNestedDoc.mock.calls.length - 1];
                    const argRoleList = isAuthCall[3];
                    expect(argRoleList.sort()).toEqual(expectedPermRoles.sort());
                }
            });
        });
    });
});
