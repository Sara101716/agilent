
1. start aem on `localhost:3000` see parent project
1. add `127.0.0.1 devwww1.agilent.com` to your `/etc/hosts`
1. run `npm i`
1. run `npm run start`
1. go to [chrome://net-internals/#hsts] to remove cached hsts for `devwww1.agilent.com`
1. access [https://devwww1.agilent.com] and have fun

Note: you might get some issues on homepages with redirects, if you need them you have return always `false` in `isCDN()` in `aem.js`.
