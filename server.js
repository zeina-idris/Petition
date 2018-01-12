const express = require('express')
const app = express()
const csrf= require('csurf')
const hb = require('express-handlebars')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cookieSession = require('cookie-session')
const spicedPg = require('spiced-pg')
const bcrypt = require('./bcrypt.js')
var db = spicedPg(process.env.DATABASE_URL || 'postgres:postgres:postgres@localhost:5432/petition');

app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: false}));
app.engine('handlebars', hb());
app.set('view engine', 'handlebars')
app.use(cookieSession({
    secret: 'a really hard to guess secret',
    maxAge: 1000 * 60 * 60 * 24 * 14
}));
app.use(csrf())
app.use(express.static(__dirname + '/public'))
app.use(function(req, res, next){
    res.locals.loggedIn = !!req.session.user
    next();
})

app.get('/register', function(req, res) {
    res.render('register', {
        csrfToken: req.csrfToken(),
        layout: 'main'
    })
})

app.post('/register', function(req, res){
    if(!req.body.first || !req.body.last || !req.body.email || !req.body.password){
        res.render('register', {
            csrfToken: req.csrfToken(),
            layout: 'main',
            error: 'Uh Oh, Seems like something went wrong. Please try again!'
        })
    } else {
        bcrypt.hashPassword(req.body.password).then(function(hash){
            db.query('INSERT INTO users (first, last, email, password) VALUES ($1, $2, $3, $4) RETURNING id', [
                req.body.first,
                req.body.last,
                req.body.email,
                hash
            ]).then(function(results){
                req.session.user = {
                    first: req.body.first,
                    last: req.body.last,
                    id: results.rows[0].id
                }
                res.redirect('/info');
            })
            .catch(function(err){
                if(err.code == 23505){
                    res.render('register', {
                        csrfToken: req.csrfToken(),
                        layout: 'main',
                        error: 'This user already exists!'
                    })
                }
            })
        })
    }
})



app.get('/login', function(req, res){
    res.render('login', {
        csrfToken: req.csrfToken(),
        layout: 'main'
    })
})
app.post('/login', function(req, res){
    if(!req.body.email || !req.body.password){
        res.render('login', {
            csrfToken: req.csrfToken(),
            layout: 'main',
            error: 'Uh Oh, Seems like something went wrong. Please try again!'
        })
    } else {
        const params = [req.body.email];
        const q = `SELECT * FROM users
        LEFT JOIN user_profiles
        ON users.id=user_profiles.user_id
        WHERE email = $1`
        db.query(q, params)
        .then(function(result){
            const data = result.rows[0];
            console.log(data);
            if (data) {
                bcrypt.checkPassword(req.body.password, data.password)
                .then(function(doesMatch){
                    if(doesMatch){
                        req.session.user = {
                            first: data.first,
                            last: data.last,
                            email: data.email,
                            age: data.age,
                            city: data.city,
                            homepage: data.url,
                            id: data.id,
                            signatureId: data.signid
                        }
                        res.redirect('/signed')
                    }else{
                        res.render('login', {
                            csrfToken: req.csrfToken(),
                            layout: 'main',
                            error: 'Sorry, your password was incorrect. Please double-check your password.'
                        })
                    }
                })
            } else {
                res.render('login', {
                    csrfToken: req.csrfToken(),
                    layout: 'main',
                    error: 'Sorry, your email was incorrect. Please double-check your email.'
                })
            }
        })
    }
})


app.get('/petition', function(req, res){

    if(req.session.signatureId){
        res.redirect('/signed')
    }else if (req.session.user){
        res.render('petition', {
            csrfToken: req.csrfToken(),
            layout: 'canvas'
        })
    } else {
        res.redirect('/register')
    }
})
app.post('/petition', function(req, res) {
    var data = req.body;
    console.log(data);
    console.log(req.session.user);
    const q = `INSERT INTO signatures (signature, user_id)
    VALUES($1, $2) RETURNING id;`
    const params = [data.signature, req.session.user.id]
    db.query(q, params)
    .then(function(results){
        req.session.user.signatureId = results.rows[0].id
        res.redirect('/signed')
    }).catch(function(err){
        console.log(err);
    })
})


app.get('/signed', function(req, res) {
        const q = `SELECT * FROM signatures WHERE user_id = $1`;
        const params = [req.session.user.id]
        db.query(q, params)
        .then(function(results) {
            console.log(results.rows);
            if(!results.rows[0]){
                res.redirect('/petition')
            }else{
                res.render('signed', {
                    csrfToken: req.csrfToken(),
                    layout: 'main',
                    signature: results.rows[0].signature
                })
            }
        }).catch(function(err){
            console.log(err);
        })
})


app.get('/signers', function(req, res) {
    const q = `SELECT first, last, age, city, url FROM users JOIN user_profiles
                ON user_profiles.user_id = users.id;`
    db.query(q)
    .then(function(result){
        console.log(result.rows);
        res.render('signers',{
            csrfToken: req.csrfToken(),
            layout: 'main',
            name: result.rows
        })
    }).catch(function(err){
        console.log(err);
    })
})


app.get('/info', function(req, res) {
    res.render('info', {
        csrfToken: req.csrfToken(),
        layout:'main'
    })
})
app.post('/info', function(req, res){
    var user_id = req.session.user.id
    var userAge = req.body.age || null
    var userCity = req.body.city || null
    var userHomepage = req.body.homepage || null

    const q = `INSERT INTO user_profiles (user_id, age, city, url) VALUES ($1, $2, $3, $4)`
    const params = [user_id, userAge, userCity, userHomepage]
    console.log(params);
    db.query(q, params)
    .then(function(result){
        res.redirect('/petition')
    })
})


app.get('/signers/:city', function(req, res){
    var city = [req.params.city]
    const q = `SELECT users.first AS first, users.last AS last, user_profiles.age, user_profiles.url
                FROM users
                JOIN user_profiles
                ON users.id = user_profiles.user_id
                WHERE user_profiles.city = $1`
    db.query(q, city)
    .then(function(result){
        res.render('signers',{
            csrfToken: req.csrfToken(),
            layout: 'main',
            name: result.rows
        })
    })
})


app.get('/profileupdate', function(req, res){
    const q = `SELECT first, last, email, age, city, url
                FROM users
                LEFT JOIN user_profiles
                ON users.id = user_profiles.user_id
                WHERE users.id = $1`
    const params = [req.session.user.id]
    db.query(q, params)
    .then(function(result){
        res.render('profileupdate', {
            csrfToken: req.csrfToken(),
            layout: 'main',
            data: result.rows[0]
        })
    })

})
app.post('/profileupdate', function(req, res){
    const data = req.body;
    const profile_params = [+data.age, data.city, data.homepage, req.session.user.id]
    const profile_q = `UPDATE user_profiles SET age = $1, city = $2, url = $3 WHERE user_id = $4`
    const user_params = [data.first, data.last, data.email, req.session.user.id]
    const user_q = `UPDATE users SET first = $1, last = $2, email = $3 WHERE users.id = $4`

    db.query(user_q, user_params)
        .then(function(){
            console.log('profile updated')
    }).catch(function(err){
        console.log('error',err);
    })

    db.query(profile_q, profile_params)
        .then(function(){
            console.log('user profile completed')
            res.redirect('/signed')
    }).catch(function(err){
        console.log('error2',err);
    })

    if(req.body.password){
        bcrypt.hashPassword(req.body.password).then(function(hash){
            db.query('UPDATE users SET password = $1', [hash])
        })
    }

})

app.get('/homepage', function(req, res){
    res.render('homepage', {
        layout: 'main'
    })
})


app.post('/deletesignature', function(req, res){
    const q =`DELETE FROM signatures WHERE user_id = $1`
    const params = [req.session.user.id]
    db.query(q, params)
    .then(function(result) {
        res.redirect('/petition')
    })
})


app.get('/about', function(req, res){
    res.render('about', {
        layout: 'main'
    })
})


app.get('/logout', function(req, res){
    req.session = null;
    res.redirect('/login')
})

app.get('/', function(req, res){
    res.redirect('/homepage')
})

app.listen(process.env.PORT || 8080, function() {
    console.log('Listening on port 8080');
})
