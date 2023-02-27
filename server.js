import { view } from '#helpers';
import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
const app = express();
import fs from 'fs';
import bodyParser from 'body-parser';
import sha256 from 'sha256';
import * as process from 'process';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import sessionFileStore from 'session-file-store';
import uuid from 'node-uuid';
import cors from 'cors';

const port = process.env.PORT;
const host = process.env.HOST_URL;
const sessionSecret = process.env.SESSION_SECRET;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('./public'));
app.use(cookieParser());

app.use(cors());

let SessionFileStore = sessionFileStore(session);

app.use(session({
    genid: () => {
        return uuid.v1();
    },
    secret: sessionSecret,
    saveUninitialized: true,
    store: new SessionFileStore({
        path: "./sessions",
        useAsync: true
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // Один день
    },
    resave: false
}));

app.use((req, res, next) => {
    res.auth = getAuthUser(req);
    next();
});

app.set('views', './views');
app.set('view engine', 'ejs');

function writeToTable(name, data) {
    fs.writeFileSync(`./database/${name}.json`, JSON.stringify(data, null, '    '), (err) => {
        if (err) throw err;
    });
}

function getDataFromTable(name) {
    const path = `./database/${name}.json`;
    if (!fs.existsSync(path)) {
        writeToTable(name, []);
    }

    const fileContent = fs.readFileSync(path, (err, data) => {
        return data;
    }).toString();

    return JSON.parse(fileContent);
}

// function addToTable(name, data, idIncrement = true) {
//     let currentData = getDataFromTable(name);

//     if (idIncrement) {
//         let lastId = getLastIdFromObjectArray(currentData);
//         data.id = ++lastId;
//     }

//     currentData.push(data);

//     writeToTable(name, currentData);
// }

function addToTable(name, data, idIncrement = true) {
    let currentData = getDataFromTable(name);

    if (idIncrement) {
        let lastId = getLastIdFromObjectArray(currentData);
        data.id = ++lastId;
    }

    currentData.push(data);

    writeToTable(name, currentData);

    return data.id;
}

function deleteFromTable(name, param, value) {
    let currentData = getDataFromTable(name);

    currentData = currentData.filter((item) => {
        return item[param] !== value;
    });

    writeToTable(name, currentData);
}

function getLastIdFromObjectArray(array) {

    let sorted = array.sort((a, b) => {
        return a.id - b.id;
    });

    if (sorted.length) {
        let lastIndex = sorted.length - 1;

        return sorted[lastIndex].id;
    }

    return 0;
}

function getItemByParamValue(array, param, value) {
    return array.find(element => element[param] === value);
}

function getAuthUser(req) {

    const sessionId = req.session.id;
    const authUsers = getDataFromTable('auth');
    const authUser = getItemByParamValue(authUsers, 'session_id', sessionId);
    const users = getDataFromTable('users');

    if (authUser) {
        return getItemByParamValue(users, 'id', authUser.user_id);
    }

    return null;
}

function writeFilteredDataTotable(name, callback) {
    let data = getDataFromTable(name);
    data = data.filter(callback);
    writeToTable(name, data);
}

function loginUser(userId, req) {
    addToTable('auth', authModel({
        user_id: userId,
        session_id: req.session.id,
        expire_time: req.session.cookie.expires,
        user_agent: req.get('User-Agent')
    }), false);

    writeFilteredDataTotable('auth', (item) => {
        return item.user_id === userId
            && new Date(item.expire_time) > new Date();
    });
}

const userModel = (data) => {
    return {
        first_name: data.first_name.toLocaleUpperCase() ?? '',
        last_name: data.last_name.toLocaleUpperCase() ?? '',
        email: data.email,
        password: sha256(data.password)
    };
}

const authModel = (data) => {
    return {
        user_id: data.user_id,
        session_id: data.session_id,
        expire_time: data.expire_time,
        user_agent: data.user_agent
    };
}

app.get('/users', (req, res) => {

    let sort = req.query.sort ?? 'desc';
    let data = getDataFromTable('users');

    let sorted = data.sort((a, b) => {
        if (sort === 'asc') return a.id - b.id;
        if (sort === 'desc') return b.id - a.id;
    });

    return view(
        res, 'pages/users',
        { title: 'Список пользователей' },
        { users: sorted }
    );
});

app.get('/register', (req, res) => {
    return view(
        res, 'pages/auth/register',
        { title: 'Регистрация' },
        { meow: 'test' }
    );
});

app.post('/register', async (req, res) => {
    addToTable('users', userModel({
        first_name: req.body.first_name ?? '',
        last_name: req.body.last_name ?? '',
        email: req.body.email,
        password: req.body.password,
    }));
    res.redirect('/');
});

app.get('/login', (req, res) => {
    return view(
        res, 'pages/auth/login',
        { title: 'Авторизация' },
        { sessionId: req.session.id }
    );
});

app.post('/login', (req, res) => {

    const reqEmail = req.body.email;
    let reqPassword = req.body.password;

    const users = getDataFromTable('users');
    const findUser = getItemByParamValue(users, 'email', reqEmail);

    if (findUser) {
        reqPassword = sha256(reqPassword);

        if (reqPassword === findUser.password) {
            const auth = getAuthUser(req);

            if (auth) {
                res.send('Вход уже выполнен.')
            } else {
                loginUser(findUser.id, req);
                res.send('Успешный вход.')
            }
        } else {
            res.send('Пароль не верный.')
        }
    } else {
        res.send('Такого пользователя не существует.')
    }
});

app.post('/logout', (req, res) => {

    let user = getAuthUser(req);

    if (user) {
        deleteFromTable('auth', 'session_id', req.session.id)
        res.send('Вы вышли.');
    } else {
        res.send('Вы не авторизированы.');
    }
});

app.post('/todolists/create', (req, res) => {
    const data = req.body;
    const task = addToTable('tasks', {
        name: data.todo,
        info: data.info,
        date: data.dateTaskAdd,
        completed: false,
        important: false,
        reminder: data.reminderTask,
    });

    const allTasks = getDataFromTable('tasks');
    const neededTask = getItemByParamValue(allTasks, 'id', task);

    res.status(200).json(neededTask);
});


app.get('/todolists', (req, res) => {
    const data = getDataFromTable('tasks');
    res.status(200).json(data);
})

app.get('/todolists/done', (req, res) => {
    const data = getDataFromTable('tasks');
    res.status(200).json(data);
})

app.get('/todolists/active', (req, res) => {
    // const allTasks = getDataFromTable('tasks');
    // const data = allTasks.filter(element => element.date === element.reminder);
    // let data = allTasks[index];
    // writeToTable('tasks', allTasks);
    const data = getDataFromTable('tasks');
    res.status(200).json(data);
})

app.put('/todolists/:id/completed-status', (req, res) => {
    const id = +req.params.id;
    const task = req.body;
    const allTasks = getDataFromTable('tasks');
    const neededTask = getItemByParamValue(allTasks, 'id', id);
    const index = allTasks.findIndex(element => element.id === id);
    let updateTask = { ...neededTask, ...task};
    allTasks[index] = updateTask;
    writeToTable('tasks', allTasks);
    
    res.status(200).json({updateTask});
    
    // res.status(200).json({ message: "Update"});
})

app.put('/todolists/:id/edit', (req,res) => {
    const id = +req.params.id;
    const task = req.body;
    const allTasks = getDataFromTable('tasks');
    const neededTask = getItemByParamValue(allTasks, 'id', id);
    const index = allTasks.findIndex(element => element.id === id);
    let editTask = { ...neededTask, ...task};
    allTasks[index] = editTask;
    const data = writeToTable('tasks', allTasks);

     res.status(200).json({editTask});
})

app.put('/todolists/:id/change-important-status', (req,res) => {
    console.log(2);
    const id = +req.params.id;
    const task = req.body;
    const allTasks = getDataFromTable('tasks');
    const neededTask = getItemByParamValue(allTasks, 'id', id);
    const index = allTasks.findIndex(element => element.id === id);
    let updateTask = { ...neededTask, ...task};
    allTasks[index] = updateTask;
    const sortTasks = allTasks.sort((a, b) => 
    b.important - a.important);
    const data = writeToTable('tasks', allTasks);
    
    res.status(200).json({updateTask});
})


app.delete('/todolists', (req, res) => {
    const data = deleteFromTable('tasks');
    res.status(200).json({ message: "Clear"});
})



app.delete('/todolists/:id', (req, res) => {
    console.log(4);
    const id = +req.params.id;
    const allTasks = getDataFromTable('tasks');
    const neededTask = getItemByParamValue(allTasks, 'id', id);

    if (neededTask) {
        const data = deleteFromTable('tasks', 'id', +req.params.id);
        res.status(200).json(neededTask);
    } else {
        res.status(404).json({message: "Error"});
    }
   
})

app.get('/', (req, res) => {
    return view(
        res, 'pages/index',
        { title: 'Главная страница' }
    );
});

app.listen(port, host);
