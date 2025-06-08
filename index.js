const express = require('express')
const app = express()
const cors = require('cors')
const port = 3000
require('dotenv').config()

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json())

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

        // Job Api

        app.get('/jobs', async (req,res)=>{

            const email = req.query.email;
            const query={}; //all data will come

            if(email){
                query.hr_email = email;
            }

            const cursor= jobCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        app.post('/jobs',async (req,res)=>{
            const newJob = req.body;
            const result = await jobCollection.insertOne(newJob)
            res.send(result)
        })

        app.get('/jobs/:id',async(req,res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await jobCollection.findOne(query)
            res.send(result)
        })

        app.get('/applications/jobs/:job_id', async(req,res)=>{
            const job_id = req.params.job_id;
            const query ={jobId: job_id}
            const result = await applicationsCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/applications',async(req,res)=>{
            const application =req.body
            const result =await applicationsCollection.insertOne(application)
            res.send(result)
        })

        app.get('/applications',async(req,res)=>{
            const email =req.query.email;

            const query ={
                applicant:email
            }

            const result = await applicationsCollection.find(query).toArray()


            for(const application of result){
                const jobId = application.jobId;
                const jobQuery = {_id: new ObjectId(jobId)}
                const job = await jobCollection.findOne(jobQuery);
                application.company = job.company
                application.title=job.title
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