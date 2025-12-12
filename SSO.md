# SSO flow

General information about the concept are documented in [Confluence](https://sparklink.collaboration.agilent.com/spaces/ARCHD/pages/900864934/SSO+Design).

The implemenation on Sirius side is split into server-side which resides in [Akamai and Wangsu CDN EdgeWorkers](https://sparksource.collaboration.agilent.com/projects/ITDS/repos/acom-sirius-web-config/browse/cdn) and the implemenation in this repository. 

One central point to understand is that we are using a standard OAuth 2.0/OIDC flow ([Authorization Code with PKCE Flow](https://developer.okta.com/docs/concepts/oauth-openid/#authorization-code-flow-with-pkce-flow)). Okta is the authorization server used. Beside or rather on top of that is Agilent's own session management application.

Because of this there is always the tokens coming from Okta and additionally some session management needed. This distinction needs to be kept in mind to avoid confusions about session expirations and lifetimes etc.

As this is a SSO setup also other application might have started or join into the same session using other authentication flows like SAML which adds additional cases which are necessary to cover.

Application running on the same *.agilent.com domain are setting a cookie `loginFlag=true` when they login a user. That's the fastest way to determine if the user is currently logged in but not 100% reliable as the login might have happened on another domain.

A safer but slightly slower way of getting the login status is the `/agsessionme` endpoint which is sometimes refered to as GlobalSessionManager (GSM). A call to this endpoint returns the current status of the session which can be used to determine the necessary next steps. That endpoint is also used to start a new session when our application triggered the login or refresh the session on user interaction. 

This proprietary user session via `/agsessionme` is rather short-lived - currently 30min - but is extended with every page load and potentically other interactions with the page. This is called the "idleTimer" as it will logout the user when inactive for a certain amount of time. The Okta tokens are valid for 24h and can be refreshed silently in the background. 

Our application needs to handle both lifetimes and trigger refreshes accordingly.

## Implementation

OIDC ID Tokens and OAuth AccessTokens are never visible to the frontend as they are stored in a httpOnly cookie. All requests needing information from those tokens or need to use them for external API calls need to be done through a CDN EdgeWorker proxy.

Login is triggered by redirecting the browser to `/sso/authorize` which is triggering an EdgeWorker starting the OAuth flow. After coming back to this application with a `?sso=success|failed` hint about the outcome the `/agsessionme` logic can be executed to also start the session on that side.

The code handling the behaviour can be found in [aem.js](scripts/aem.js):
- `#initSSO()` will handle the case when coming back from the login flow and also the cases when another application has logged in the user setting the `loginFlag=true` cookie
- `#checkSSO()` will handle the refresh needed on every page load and also the cases when the user was logged in with another application not setting the `loginFlag=true` cookie
- with `#refreshSSO()` other parts of the application can trigger a reset of the idle timer when the user interacts with the UI which do not trigger a page load, for example clicking filters on the search.
- `#login()` and `#logout()` can be used to trigger the respective flow, for example on user click on the header login/account button
- `#isLoggedIn()` and `#getUserInfo()` can be used for checking the login status and getting information about the user, currently only the name is available
- `#startSSOTimers()` handles the TTLs of the session and the tokens and potentially refreshes them if necessary or logging out the user when the time is up
- `#ssoLogoutCheck` regularly checks the status of the global session via agsessionme
