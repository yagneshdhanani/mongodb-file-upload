const express = require("express");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const mongoose = require("mongoose");
const GridFsStorage = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
require("dotenv").config();

const methodOverride = require("method-override");

const app = express();
const PORT = process.env.PORT || 3000;

// * MiddleWare
app.use(express.json());
app.use(methodOverride("_method"));
app.set("view engine", "ejs");

// * Init Gfs
let gfs;

// * DB Connection
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "Connection error:"));
db.once("open", () => {
  // gfs = new mongoose.mongo.GridFSBucket(db.db, {
  //   bucketName: "uploads",
  // });

  gfs = Grid(db.db, mongoose.mongo);
  gfs.collection("uploads");
  console.log("Connected to DB");
  // console.log(gfs);
});

// * Create Storage Engine
const storage = new GridFsStorage({
  url: MONGO_URI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "uploads",
        };
        resolve(fileInfo);
      });
    });
  },
});
const upload = multer({ storage });

// @route GET /
// @desc Loads form
app.get("/", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    // Check for files
    if (!files || files.length === 0)
      return res.render("index", { files: false });

    files.map((file) => {
      // Check for image
      if (
        file.contentType === "image/jpeg" ||
        file.contentType === "image/png"
      ) {
        file.isImage = true;
      } else {
        file.isImage = false;
      }
    });
    // console.log(files);
    res.render("index", { files: files });
  });
});

// @route POST /upload
// @desc Uploads files to DB
app.post("/upload", upload.array("file", 3), (req, res) => {
  // res.json({ file: req.files });
  res.redirect("/");
});

// @route GET /files
// @desc Display all files in JSON
app.get("/files", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    // Check for files
    if (!files || files.length === 0) {
      return res.status(404).send({ err: "No files found!" });
    }

    // Files exists
    return res.json(files);
  });
});

// @route GET /files/:filename
// @desc Display single file in JSON
app.get("/files/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check for file
    if (!file || file.length === 0) {
      return res.status(404).send({ err: "No file found!" });
    }

    // Files exist
    return res.json(file);
  });
});

// @route GET /image/:filename
// @desc Display Image
app.get("/image/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check for file
    if (!file || file.length === 0) {
      return res.status(404).send({ err: "No file found!" });
    }

    if (err) return res.json({ err });

    // Check for image
    if (file.contentType === "image/jpeg" || file.contentType === "image/png") {
      // Read output to browser
      // gfs.openDownloadStreamByName(req.params.filename).pipe(res);

      const readStream = gfs.createReadStream(file.filename);
      readStream.pipe(res);
    } else {
      res.status(404).json({ err: "Image not found" });
    }
  });
});

// @route DELETE /files/:filename
// @desc Delete single file
app.delete("/files/:id", (req, res) => {
  gfs.remove({ _id: req.params.id, root: "uploads" }, (err, gridStore) => {
    console.log("err", err);

    if (err) return res.status(404).json({ err: err });
    res.redirect("/");
  });
});

app.listen(PORT, () => console.log(`Server is running on ${PORT}`));
