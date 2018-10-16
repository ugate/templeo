const http = require('http');
const Fs = require('fs');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  const html = Fs.readFileSync('./_test.html');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.end(html);
});
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});