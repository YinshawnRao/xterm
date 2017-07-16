var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var app = express();
//WebSocket endpoints for Express
var expressWs = require('express-ws')(app);

//nodejs版的虚拟终端，需要python环境
var pty = require('node-pty');
//ssh
var Client = require('ssh2').Client;

var terminals = {},
    logs = {};

app.use(bodyParser.urlencoded({ extended: false }))

app.set('views',path.join(__dirname , 'views') );
app.engine('.html', require('ejs').__express);  
app.set('view engine', 'html');

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

  //自定义SSH
  term.write('ssh root@115.159.48.163\r');

  terminals[term.pid] = term;

  logs[term.pid] = '';
  term.on('data', function(data) { 
		if(data.toString() === "root@115.159.48.163's password: ") {
			term.write('340dAC4b5db061DEV2ba$%#&7^a9dec7eb7bb6de\r');			
		} 	
		if(data.toString().indexOf('Last login:') >= 0) {
	  		term.write('clear\r');

	  		res.send(term.pid.toString());
  			res.end();

	  	}
			
   		logs[term.pid] += data;
  });  

});

//修改size
app.post('/terminals/:pid/size', function (req, res) {
  var pid = parseInt(req.params.pid),
      cols = parseInt(req.query.cols),
      rows = parseInt(req.query.rows),
      term = terminals[pid];

  term.resize(cols, rows);
  console.log('Resized terminal ' + pid + ' to ' + cols + ' cols and ' + rows + ' rows.');
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


var sshConn, sshLogs = '';

//登录
app.post('/ssh/login', function (req, res, next) {

	sshLogs = '';
	sshConn = new Client();
	var body = req.body;

	sshConn.connect({
	  host: body.inputHost,
	  port: 22,
	  username: body.inputUsername,
	  password: body.inputPassword
	});

	sshConn.on('ready', function() {
		console.log('Client :: ready');

		sshConn.shell(function(err, stream) {
		    if (err) throw err;
		    stream.on('close', function() {
		      console.log('Stream :: close');		      
		      sshConn.end();
		    }).on('data', function(data) {

		      sshLogs += data;

		    }).stderr.on('data', function(data) {
		      console.log('STDERR: ' + data);
		    });
		 });

	});

	res.render('ssh', {
  		title: 'terminal ' + body.inputHost
  	});

});


//登录
//初始化信息


app.ws('/ssh', function (ws, req) {

	ws.send(sshLogs)
// console.log(sshLogs)
	ws.on('message', function(msg) {
	   
		sshConn.shell(function(err, stream) {
		    if (err) throw err;
		    stream.on('close', function() {
		      console.log('Stream :: close');
		      sshConn.end();
		    }).on('data', function(data) {		    
console.log(data.toString())
		      ws.send(data.toString());

		    }).stderr.on('data', function(data) {
		      console.log('STDERR: ' + data);
		    });

		    stream.write(msg);

		 });		

	});

	ws.on('close', function () {
	    sshConn.end();	    
	});

});


app.listen(3000);


