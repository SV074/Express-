const path = require('path');
const express = require('express');
const app = express();
const fs = require('fs');
const bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')))

// app.get('/', (req, res) => {
//     res.send(`${__dirname}/public/index.html`);
// });

app.get('/degree', (req, res) => {
    res.send({ message: 'Hello Alex' });
});

let users = [
    {
        id: 1,
        name: 'Alex'
    }
];


// function pushUsers(id, name) {

//   return new Promise((resolve, reject) => {
//     setTimeout(resolve, ms)
//   });

//     users.push({
//         id: id,
//         name: name
//     })
// }

// Функция записи юзера
function writeUsers(data) {
    fs.writeFileSync(`${__dirname}/users.json`, JSON.stringify(data), (err) => {
        if (err) throw err;
    });
}

// Функция получения юзера 
function getUsers() {
    const fileContent = fs.readFileSync(`${__dirname}/users.json`, function(err, data) {
        return data;
    }).toString();

    return JSON.parse(fileContent);
}



app.post('/users/create', async (request, response) => {

    // let foo = {};

    console.log(request.body);

    let users = getUsers();    

    // let lastId = 

    users.push({
        id: request.body.id,
        name: request.body.name
    })
    //Math.max.apply(Math, users.map(function(o) { return o.id + 1; }))
    writeUsers(users);

    response.send(foo);
});




app.get('/users', (req, res) => {


    res.send(getUsers());

});



app.listen(80, () => {
    console.log('Application listening on port 80!');
});