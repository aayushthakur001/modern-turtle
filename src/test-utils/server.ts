import type * as expressType from 'express';
import type * as mongooseType from 'mongoose';
import MockStrategy from 'passport-mock-strategy';
import passport from 'passport';
import getPort from 'get-port';
import type * as http from 'http';
import { clearDatabase, connectToDatabase } from './mongo';

export const MOCK_PROVIDER = 'mock';

export const mockMiddleware = (req: expressType.Request, res: expressType.Response, next: expressType.NextFunction): void => {
    next();
};
export const mockServerModules = ({
    mongoose,
    jest,
    configData
}: {
    mongoose: typeof mongooseType;
    jest: Record<any, any>;
    configData: Record<any, any>;
}): void => {
    jest.mock('source-map-support', () => ({
        install: jest.fn()
    }));
    jest.mock('aws-sdk', () => ({
        SharedIniFileCredentials: jest.fn(),
        S3: jest.fn().mockImplementation(),
        config: {
            credentials: {},
            update: jest.fn()
        }
    }));

    jest.mock('@sentry/node', () => ({
        init: jest.fn(),
        Handlers: {
            requestHandler: () => mockMiddleware,
            errorHandler: () => mockMiddleware
        }
    }));

    const morgan = () => mockMiddleware;
    morgan['token'] = () => 'foo';
    jest.mock('morgan', () => morgan);
    jest.mock('../../../models/init-mongo', () => {
        return {
            mongooseConnection: mongoose.connection
        };
    });
    jest.mock('../../../base-config', () => configData);

    jest.mock('../../../services/analytics/analytics', () => ({
        track: jest.fn()
    }));
    jest.mock('../../../services/logger', () => ({
        debug: () => console.log,
        info: () => console.log,
        error: () => console.log
    }));
    // todo https://gist.github.com/mweibel/5219403
    jest.mock('../../../services/auth-service/passport-init', () => passport);
    jest.mock('../../../services/deploy-services/container-orchestration-service', () => ({
        initializeContainerEnvironments: jest.fn()
    }));

    jest.mock('../../../services/services', () => ({
        init: async () => {
            await connectToDatabase(mongoose);
            // crashing tests
            await clearDatabase(mongoose);
        }
    }));
};

export const startServer = async ({
    mongoose,
    jest,
    configData,
    provider
}: {
    mongoose: typeof mongooseType;
    jest: Record<any, any>;
    configData: Record<any, any>;
    provider: string;
}): Promise<{
    app: expressType.Application;
    server: http.Server;
}> => {
    mockServerModules({ mongoose, jest, configData });
    const startServer = require('../server');
    const serverPort = await getPort();
    return startServer({ provider, serverPort });
};

type IDoneCb = (Error: unknown, user?: any) => void;
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const mockUserAuthRequest = (user: any): void => {
    passport.serializeUser((user: any, done: IDoneCb) => {
        done(null, user.id);
    });
    passport.deserializeUser((id: string, done: IDoneCb) => {
        if (id === user.id) {
            done(null, user);
        } else {
            done(new Error(`No such user with id ${id}`));
        }
    });
    passport.use(
        new MockStrategy({
            name: MOCK_PROVIDER,
            user
        })
    );
};
