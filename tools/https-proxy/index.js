import fs from 'fs';
import https from 'https';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  secure: false,
});

const options = {
  key: fs.readFileSync('./devwww1.agilent.com-key.pem'),
  cert: fs.readFileSync('./devwww1.agilent.com.pem'),
};

https.createServer(options, (req, res) => {
  const url = req.url || '';
  if (url.startsWith('/sso/') || url.startsWith('/coveo/')) {
    proxy.web(req, res, {
      target: 'http://localhost:9550',
    });
  } else {
    proxy.web(req, res, {
      target: 'http://localhost:3000',
    });
  }
}).listen(443, () => {
  console.log('HTTPS proxy listening on https://devwww1.agilent.com');
});
