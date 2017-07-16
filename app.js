var express = require('express');
var app = express();
//WebSocket协议是基于TCP的一种新的网络协议。
//它实现了浏览器与服务器全双工(full-duplex)通信——允许服务器主动发送信息给客户端
//WebSocket endpoints for Express
var expressWs = require('express-ws')(app);

//nodejs版的虚拟终端，需要python环境
var pty = require('node-pty');

var terminals = {},
    logs = {};

app.use(express.static('public'));
 
app.post('/terminals', function(req, res, next){

  var cols = parseInt(req.query.cols),
      rows = parseInt(req.query.rows);

  var term = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
    name: 'xterm-color',
    cols: cols,
    rows: rows,
    cwd: process.env.PWD,
    env: process.env
  });

  console.log('Created terminal with PID: ' + term.pid);

  terminals[term.pid] = term;

  logs[term.pid] = '';
  term.on('data', function(data) {
    logs[term.pid] += data;
  });

  res.send(term.pid.toString());
  res.end();

});


//核心传输逻辑
app.ws('/terminals/:pid', function (ws, req) {

	var term = terminals[parseInt(req.params.pid)];
	  console.log('Connected to terminal ' + term.pid);
	  ws.send(logs[term.pid]);

	term.on('data', function(data) {
	    try {
	      ws.send(data);
	    } catch (ex) {
	      // The WebSocket is not open, ignore
	    }
	});

	ws.on('message', function(msg) {
	   term.write(msg);
	});

	ws.on('close', function () {
	    term.kill();
	    console.log('Closed terminal ' + term.pid);
	    // Clean things up
	    delete terminals[term.pid];
	    delete logs[term.pid];
	  });


});


app.listen(3000);


