const express = require('express');
const app = express();
const path = require('path')
const { v4: uuid } = require("uuid")
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
const s3 = new AWS.S3()

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});


const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = "SanPham";


const multer = require('multer');

const storage = multer.memoryStorage({
    destination(req, file, callback){
        callback(null, '');
    },
});

function checkFileType(file, cb){
    const fileTypes = /jpeg|jpg|png|gif/;

    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase())
    const minetype = fileTypes.test(file.mimetype)


    if (extname && minetype){
        return cb(null,true)
    }

    return cb("Error: Image Only")
}   

const upload = multer({
    storage,
    limits: { fileSize:2000000 }, 
    fileFilter(req, file, cb){
        console.log(file)
        checkFileType(file, cb);
    }
});

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

const CLOUD_FRONT_URL = 'https://d3gwzzvwt1bn1m.cloudfront.net'

app.post("/", upload.single('image'), (req, res) => {
    const { MaSP, TenSP, SoLuong } = req.body;
    const image = req.file.originalname.split(".");

    const fileType = image[image.length-1];

    const filePath = `${uuid() + Date.now().toString()}.${fileType}`
    const params = {
        Bucket: "lab7-bukets3",
        Key: filePath,
        Body: req.file.buffer
    }

    s3.upload(params, (error, data) =>{
        if(error) {
            console.log('error = ', error)
            return res.send('Internal Server Error')
        }else{
            const newItem = {
                TableName: tableName,
                Item: {
                    "MaSP": MaSP,
                    "TenSP": TenSP,
                    "SoLuong": SoLuong,
                    "url": `${CLOUD_FRONT_URL}/${filePath}`
                }
            };
        
        
            docClient.put(newItem, (err, data) => {
                if (err) {
                    return res.send("Internal Server Error");
                } else {
                    return res.redirect("/");
                }
            });
        }
    })
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
