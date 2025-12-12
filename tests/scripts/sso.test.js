/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';
import {
  isLoggedIn,
  getUserInfo,
  login,
  logout,
  // initSSO,
  // checkSSO,
} from '../../scripts/aem.js';

let localStorageMock;
let cookieMock;
let locationMock;
jest.useFakeTimers();

describe('SSO', () => {
  beforeEach(() => {
    localStorageMock = {};
    globalThis.localStorage = {
      getItem: (name) => localStorageMock[name],
      setItem: (name, value) => { localStorageMock[name] = value; },
      removeItem: (name) => delete localStorageMock[name],
    };
    globalThis.document = {};
    Object.defineProperty(globalThis.document, 'cookie', {
      get: () => cookieMock,
    });
    globalThis.window = {};
    locationMock = new URL('https://www.agilent.com');
    globalThis.window.location = Object.defineProperties({}, {
      href: {
        get: () => locationMock.href,
        set: (href) => { locationMock = new URL(href, locationMock); },
      },
    });
    globalThis.window.history = {
      replaceState: jest.fn(),
    };
  });

  test('check logged in status', async () => {
    cookieMock = 'loginFlag=true';
    expect(isLoggedIn()).toBe(true);
    cookieMock = 'loginFlag=false';
    expect(isLoggedIn()).toBe(false);
  });

  test('check user info', async () => {
    localStorageMock.userName = 'Test User';
    localStorageMock.customerType = 'member';
    localStorageMock.groups = ['ROLE_MEMBER'];
    expect(getUserInfo()).toBe(false);
    cookieMock = 'loginFlag=false';
    expect(getUserInfo()).toBe(false);
    cookieMock = 'loginFlag=true';
    expect(getUserInfo()).toStrictEqual({ name: 'Test User', customerType: 'member', groups: ['ROLE_MEMBER'] });
  });

  test('login', async () => {
    login();
    expect(locationMock.pathname).toBe('/sso/authorize');
    expect(locationMock.searchParams.has('refresh')).toBe(false);
    locationMock = new URL('https://www.agilent.com');
    login(true);
    expect(locationMock.pathname).toBe('/sso/authorize');
    expect(locationMock.searchParams.has('refresh')).toBe(true);
  });

  test('logout', async () => {
    localStorageMock.userName = 'Test User';
    logout();
    expect(localStorageMock.userName).toBeUndefined();
    expect(locationMock.pathname).toBe('/sso/logout');
  });

  // test('initSSO', async () => {
  //   await initSSO();
  //   jest.runAllTimers();

  //   globalThis.window.history.replaceState.mockClear();
  //   const urlWithoutParameter = locationMock.href;
  //   locationMock.searchParams.set('sso', 'success');
  //   const agSessionMeDefaultResponse = JSON.stringify({ agsessionme: 'true', TTL: 1800 });
  //   const agSessionMeCustomRespones = [];
  //   fetch.mockResponse((req) => {
  //     switch (req.url) {
  //       case '/sso/userinfo?token':
  //         return Promise.resolve(JSON.stringify({ name: 'Test User', expiration: 123 }));
  //       case '/.env/config.json':
  //         return Promise.resolve(JSON.stringify({ data: [ { Key: 'ssoApiBaseUrl', Text: 'https://sso.example.com' } ] }));
  //       case 'https://sso.example.com/agsessionme':
  //         if (req.method === 'POST') {
  //           return req.json().then((body) => {
  //             if (body.action === 'create') {
  //               return JSON.stringify({ created: true });
  //             }
  //             if (body.action === 'checkping') {
  //               return agSessionMeDefaultResponse
  //             }
  //             throw new Error(`Invalid action [${req.url}], [${JSON.stringify(body)}]`);
  //           })
  //         }
  //         if (agSessionMeCustomRespones.length > 0) {
  //           return Promise.resolve(agSessionMeCustomRespones.shift());
  //         }
  //         return Promise.resolve(agSessionMeDefaultResponse);
  //       default:
  //         return Promise.reject(new Error(`unexpected request [${req.url}]`));
  //     }
  //   });

  //   await initSSO();
  //   jest.runAllTimers();

  //   expect(globalThis.window.history.replaceState).toHaveBeenCalledTimes(1);
  //   expect(globalThis.window.history.replaceState).toHaveBeenCalledWith(
  //     null,
  //     '',
  //     urlWithoutParameter
  //   );
  // // above is a very basic test, what we would actually need to test:
  // //   nothing to do
  // //   sso=success -> create session, set user info, start timers
  // //   sso=failed -> logout, show error message
  // //   login flag set but no user info in the local storage
  // //     -> checkSSO (multiple cases, see below ...)
  // //   error cases for all of the above -> logout
  // });

  // test('checkSSO', async () => {
  //   const agSessionMeDefaultResponse = JSON.stringify({ agsessionme: 'true', TTL: 1800 });
  //   const agSessionMeCustomRespones = [];
  //   fetch.mockResponse((req) => {
  //     switch (req.url) {
  //       case '/sso/userinfo?token':
  //         return Promise.resolve(JSON.stringify({ name: 'Test User', expiration: 123 }));
  //       case '/.env/config.json':
  //         return Promise.resolve(JSON.stringify({ data: [ { Key: 'ssoApiBaseUrl', Text: 'https://sso.example.com' } ] }));
  //       case 'https://sso.example.com/agsessionme':
  //         if (req.method === 'POST') {
  //           return req.json().then((body) => {
  //             if (body.action === 'create') {
  //               return JSON.stringify({ created: true });
  //             }
  //             if (body.action === 'checkping') {
  //               return agSessionMeDefaultResponse
  //             }
  //             throw new Error(`Invalid action [${req.url}], [${JSON.stringify(body)}]`);
  //           })
  //         }
  //         if (agSessionMeCustomRespones.length > 0) {
  //           return Promise.resolve(agSessionMeCustomRespones.shift());
  //         }
  //         return Promise.resolve(agSessionMeDefaultResponse);
  //       default:
  //         return Promise.reject(new Error(`unexpected request [${req.url}]`));
  //     }
  //   });

  //   await checkSSO();
  //   jest.runAllTimers();

  //   agSessionMeCustomRespones.push(JSON.stringify({ agsessionme: 'true', TTL: -1 }));
  //   await checkSSO();
  //   expect(locationMock.pathname).toBe('/sso/authorize');
  //   expect(locationMock.searchParams.has('refresh')).toBe(true);

  //   agSessionMeCustomRespones.push(JSON.stringify({ agsessionme: 'false' }));
  //   await checkSSO();

  //   cookieMock = 'loginFlag=true';
  //   await checkSSO();
  //   expect(locationMock.pathname).toBe('/sso/logout');

  //   jest.runAllTimers();
  // // above is a very basic test, I did not succeed in making it robust with the timers,
  // // what we would actually need to test:
  // //   nothing to do
  // //   already initialising
  // //   no active session no login flag no user info -> logout
  // //   no active session loginFlag=true no user info -> logout
  // //   no active session no login flag, user info set -> logout
  // //   active session, TTL -1 -> login
  // //   active session, TTL>0 -> refresh session
  // //   error cases for all of the above
  // });

  // test('ssoTimers', async () => {
  // TestCases:
  //   ...
  // });

  // test('idleTimers', async () => {
  // TestCases:
  //   ...
  // });
});
