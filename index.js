const express = require('express');
const app = express();
require('dotenv').config()

app.use(express.json({extended: false}));  
app.use(express.static('./views'))
app.set('view engine', 'ejs');
app.set('views', './views');

const AWS = require('aws-sdk');
const config = new AWS.Config({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: 'us-east-1'
});
AWS.config = config;

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = "SanPham";

const multer = require('multer');
const upload = multer();

app.get("/", (request, response) => {
    const params = { TableName: tableName };

    docClient.scan(params, (err, data) => {
        if (err) {
            response.send("Internal Server Error");
        } else {
            return response.render("index", { sanPhams: data.Items });
        }
    });
});


app.post("/", upload.fields([]), (req, res) => {
    const { MaSP, TenSP, SoLuong } = req.body;

    const params = {
        TableName: tableName,
        Item: {
            "MaSP": MaSP,
            "TenSP": TenSP,
            "SoLuong": SoLuong
        }
    };


    docClient.put(params, (err, data) => {
        if (err) {
            return res.send("Internal Server Error");
        } else {
            return res.redirect("/");
        }
    });
});

app.post("/delete", upload.fields([]), (req, res) => {
    const listItems = Object.values(req.body);

    if (listItems.length === 0) {
        return res.redirect("/");
    }


    function onDeleteItem(index) {
        const params = {
            TableName: tableName,
            Key: {
                "MaSP": listItems[index]+""
            }
        };

        docClient.delete(params, (err, data) => {
            if (err) {
                return res.send("Internal Server Error");
            } else {
                if (index > 0) {
                    onDeleteItem(index - 1);
                } else {
                    return res.redirect("/");
                }
            }
        });
    }

    onDeleteItem(listItems.length - 1);
});
