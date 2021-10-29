import type * as mongooseType from 'mongoose';
import { createModelGovernance } from '../../organization-models-access-control';
import type { ModelWithRestrictedNestedEntities } from './role-assignment-nested';
import { ITest, ITestDoc, TestRoles } from './role-assignment.test-data';

// controlled parent with controlled sub entities
export interface ITestOrg {
    name: string;
    tests?: ITest[];
}

export interface ITestOrgDoc extends ITestOrg, mongooseType.Document<mongooseType.Types.ObjectId> {
    id?: string;

    tests?: ITestDoc[];
}

export const TEST_ORG_NESTED_ENTITY_FIELDS = { tests: 'tests' } as const;
export interface ITestOrgModel
    extends mongooseType.Model<ITestOrgDoc>,
        ModelWithRestrictedNestedEntities<keyof typeof TEST_ORG_NESTED_ENTITY_FIELDS, TestRoles> {}

export const TEST_ORG_PERMISSIONS = {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE'
} as const;

export const TEST_ORG_ROLES = {
    EDITOR: 'EDITOR',
    ADMIN: 'ADMIN'
} as const;

export type TestOrgPermission = keyof typeof TEST_ORG_PERMISSIONS;
export type TestOrgRoles = keyof typeof TEST_ORG_ROLES;

const TEST_ORG_ROLE_PERMISSIONS = {} as Record<TestOrgRoles, TestOrgPermission[]>;
TEST_ORG_ROLE_PERMISSIONS[TEST_ORG_ROLES.EDITOR] = [TEST_ORG_PERMISSIONS.UPDATE];
TEST_ORG_ROLE_PERMISSIONS[TEST_ORG_ROLES.ADMIN] = [TEST_ORG_PERMISSIONS.UPDATE, TEST_ORG_PERMISSIONS.CREATE];

export const TestOrgAccessControl = createModelGovernance<TestOrgPermission, TestOrgRoles>(TEST_ORG_ROLE_PERMISSIONS);
