import { Account, Client, Databases, ID, Query, Users } from "node-appwrite";
import "dotenv/config";
import express from 'express'
const env = process.env;
const app = express()
const port = env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({extended: true}))

const databaseName = env.DATABASE_NAME;

const client = new Client()
  .setEndpoint("https://baas.moevedigital.com/v1")
  .setProject("667afb24000fbd66b4df")
  .setKey(env.API_KEY_NAJA);

const checkExistUser = async (phone) => {
  const database = new Databases(client);
  const users = await database.listDocuments(databaseName, "user", [
    Query.equal("phone", phone),
    Query.limit(1),
  ]);
  let userId;
  users.documents.forEach((value, index) => {
    console.log("🚀 ~ users.documents.forEach ~ value:", value.$id);
    console.log("ya");
    userId = value["userId"];
  });
  
  return userId
};

const getToken = async (userId) => {
  console.log("🚀 ~ getToken ~ userId:", userId);
  const users = new Users(client);
  const token = await users.createToken(userId);
  console.log("🚀 ~ getToken ~ token:", token);
  const secret = token.secret;
  console.log("🚀 ~ getToken ~ secret:", secret);
};

const createAccount = async () => {
    const account = new Account(client)
    account.create()
}

app.post("/sign-up", async (req, res) => {
    const body = req.body
    console.log("🚀 ~ app.post ~ body:", body)
    const roleUserId = "669a2cfd00141edc45ef"
    const database = new Databases(client)
    database.createDocument(databaseName, 'user', ID.unique(), {
        username: body.username,
        
    })
    res.json({
        status: false,
    })
})

app.post("/sign-in", async (req, res) => {
    const body = req.body
    const phoneNumber = body.phoneNumber
    const userId = await checkExistUser(phoneNumber)
    // if(userId){
    //     getToken(userId)
    // }
    console.log("🚀 ~ app.post ~ userId:", userId)
    
    res.json({
        userId: userId || null,
    })
})

app.listen(port, () => {
    console.log(`listen on port ${port}`);
    
})