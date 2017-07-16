var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var app = express();
//WebSocket endpoints for Express
var expressWs = require('express-ws')(app);

//nodejs版的虚拟终端，需要python环境
var pty = require('node-pty');

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

  var host = req.body.inputHost,
  	  username = req.body.inputUsername,
  	  password = req.body.inputPassword;

  var isSSH = (typeof host != 'undefined') && (typeof username != 'undefined') && (typeof password != 'undefined');

  var term = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
    name: 'xterm-color',
    cols: cols,
    rows: rows,
    cwd: process.env.PWD,
    env: process.env
  });

  console.log('Created terminal with PID: ' + term.pid);

  //自定义SSH
  isSSH && term.write('ssh '+username+'@'+host+'\r');

  terminals[term.pid] = term;

  var isLogin = false;

  logs[term.pid] = '';
  term.on('data', function(data) { 
  		if(isSSH) {
  			if(data.toString() === username+"@"+host+"'s password: ") {
				term.write(password+'\r');			
			} 	
			if(data.toString().indexOf('Last login:') >= 0) {
		  		term.write('clear\r');
		  		isLogin = true;
		  		res.render('ssh', {
		  			pid: term.pid.toString()
		  		});
		  		return;
		  	}
  		}	
   		logs[term.pid] += data;
  });

  setTimeout(function() {
  	if(isSSH && !isLogin) {
		res.send('connect timeout');
		res.end();
		return;
	}	
  }, 3000);

  if(!isSSH) {
  	res.send(term.pid.toString());
	res.end();
	return;
  }

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


app.listen(3000);


