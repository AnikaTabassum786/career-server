const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const port = 3000
require('dotenv').config()

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware

// app.use(cors());  // for localStorage

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials:true
}));
app.use(express.json());
app.use(cookieParser());

// Firebase
var admin = require("firebase-admin");

var serviceAccount = require('./user-management-5f10f-firebase-adminsdk-fbsvc-afc0f01f33.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const logger = (req,res,next) =>{
    console.log('inside the logger middleware')
    next()
}

const verifyToken=(req,res,next)=>{
  const token = req?.cookies?.token;
  console.log('cookie in the middleware',token)

  if(!token){
    return res.status(401).send({message: 'unauthorized access'})
  }

  jwt.verify(token,process.env.JWT_ACCESS_SECRET,(err,decoded)=>{
    if(err){
        return res.status(401).send({message:'unauthorized access'})
    }
    req.decoded = decoded;
    next()
  })
}

const verifyFirebaseToken = async (req,res,next) =>{
    const authHeader = req.headers?.authorization;
    const token = authHeader.split(' ')[1];

    if(!token){
        return res.send(401).send({message:'unauthorized access'})
    }
    const userInfo = await admin.auth().verifyIdToken(token)
    console.log('inside the token', userInfo)
    req.tokenEmail = userInfo.email;
    next();
 
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.q12amc9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const jobCollection = client.db("job_portal").collection("jobs");
        const applicationsCollection = client.db("job_portal").collection("applications")

        //JWT token related api

        // localStorage

        /*
        app.post('/jwt', async (req, res) => {
            const { email } = req.body;
            const user = { email }
            const token = jwt.sign(user, process.env.JWT_ACCESS_SECRET , { expiresIn: '1h' }) //The user data (here, just the email)
            res.send({ token })
        })
       */

        // http Cookie

        app.post('/jwt',async(req,res)=>{
            const userData = req.body;
            const token = jwt.sign(userData,process.env.JWT_ACCESS_SECRET,{expiresIn:'1d'}) 

            // set token in cookies
            res.cookie('token',token,{
                httpOnly:true,
                secure:false
            })

            res.send({success:true})
        })

        // Job Api

        app.get('/jobs', async (req, res) => {

            const email = req.query.email;
            const query = {}; //all data will come

            if (email) {
                query.hr_email = email;
            }

            const cursor = jobCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        app.post('/jobs', async (req, res) => {
            const newJob = req.body;
            const result = await jobCollection.insertOne(newJob)
            res.send(result)
        })

        app.get('/jobs/applications',verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { hr_email: email };
            const jobs = await jobCollection.find(query).toArray()

            for (const job of jobs) {
                const applicationQuery = { jobId: job._id.toString() }
                const application_count = await applicationsCollection.countDocuments(applicationQuery)
                job.application_count = application_count
            }

            res.send(jobs)
        })

        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobCollection.findOne(query)
            res.send(result)
        })

        app.get('/applications/jobs/:job_id', async (req, res) => {
            const job_id = req.params.job_id;
            const query = { jobId: job_id }
            const result = await applicationsCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/applications', async (req, res) => {
            const application = req.body
            const result = await applicationsCollection.insertOne(application)
            res.send(result)
        })

        app.patch('/applications/:id', async (req, res) => {
            const id = req.params.id;
            const filter = {
                _id: new ObjectId(id)
            }

            const updatedDoc = {
                $set: {
                    status: req.body.status
                }
            }

            const result = await applicationsCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.get('/applications',logger,verifyFirebaseToken, async (req, res) => {

            const email = req.query.email;
  
            // Firebase

            if(req.tokenEmail != email){
                return res.status(403).send({message: 'forbidden access'})
            }
            
            // Cookie

            // if(email !== req.decoded.email){
            //   return res.status(403).send({message:'Forbidden Access'})
            // }

            const query = {
                applicant: email
            }

            const result = await applicationsCollection.find(query).toArray()

            for (const application of result) {
                const jobId = application.jobId;
                const jobQuery = { _id: new ObjectId(jobId) }
                const job = await jobCollection.findOne(jobQuery);
                application.company = job.company
                application.title = job.title
                application.company_logo = job.company_logo
            }

            res.send(result)

        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Career Service!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})