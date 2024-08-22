import path from 'path'
import { fileURLToPath } from 'url'
import { Account, Client, Databases, ID, Query, Users } from "node-appwrite";
import "dotenv/config";
import express from 'express'
import {router as bankRouter} from './bank.js'
import cors from 'cors'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const env = process.env;
const app = express()
const port = env.PORT || 3000

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())
app.use(express.urlencoded({extended: true}))

app.use('/bank', bankRouter)
const databaseName = env.DATABASE_NAME;
const SECRET_KEY = env.SECRET_KEY;

const client = new Client()
  .setEndpoint(env.APPWRITE_URL)
  .setProject(env.PROJECT_ID)
  .setKey(env.API_KEY_NAJA);

const checkExistUser = async (phone) => {
  const database = new Databases(client);
  const users = await database.listDocuments(databaseName, "user", [
    Query.equal("phone", phone),
    Query.limit(1),
  ]);
  let userId;
  users.documents.forEach((value, index) => {
    userId = value["userId"];
  });
  
  return userId
};

const getToken = async (userId) => {
  const users = new Users(client);
  const token = await users.createToken(userId);
  return token
};

const createAccount = async (email, password, name) => {
    try {
      const account = new Account(client)
      const user = await account.create(
        ID.unique(),
        email,
        password,
        name,
      )
      return user
    } catch (error) {
      console.error(`createAccount: ${error}`)
    }
}

const verifyCloudflare = async (request, response) => {
  const body = await request.body;
  // Turnstile injects a token in "cf-turnstile-response".
  const token = body["cf-turnstile-response"];
  const ip = request.headers["CF-Connecting-IP"];
  // Validate the token by calling the "/siteverify" API.
  let formData = new FormData();
  formData.append("secret", SECRET_KEY);
  formData.append("response", token);
  formData.append("remoteip", ip);
  const result = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      body: formData,
      method: "POST",
    }
  );

  const outcome = await result.json();
  if (!outcome.success) {
    console.error("failed !!");
    
    response.status = 403
    response.statusText = "failed"
    return response.json({
      message: `The provided Turnstile token was not valid!`,
      data: outcome,
    })
    
  }
  // The Turnstile token was successfuly validated. Proceed with your application logic.
  // Validate login, redirect user, etc.
  // For this demo, we just echo the "/siteverify" response:
  return response.json({
    message: `Turnstile token successfuly validated.`,
    data: outcome,
  })
  // return new Response(
  //   "Turnstile token successfuly validated. \n" + JSON.stringify(outcome)
  // );
}

app.get("/", (req, res) => {
  console.log("🚀 ~ app.get ~ req:", req.headers)
  // maybe block other x-requested-with: 'com.example.lottery_ck' - sawanon:20240808
  res.setHeader("Content-Type", "text/html")
  res.sendFile(path.join(__dirname, 'public', 'explicit.html'))
})

app.post("/verifyCloudflare", async (req, res) => {
  verifyCloudflare(req, res)
})

app.post("/sign-up", async (req, res) => {
    const body = req.body
    const {username, firstName, lastName, email, phone, address} = body
    const multiplier = (phone.substring(phone.length, phone.length - 1) * phone.substring(phone.length - 2, phone.length -3)).toString()
    const lastPhone = multiplier.substring(multiplier.length, multiplier.length - 1)
    const password = `${phone.substring(0, 4)}${lastPhone}${phone.substring(4)}`
    const user = await createAccount(email, password, `${firstName} ${lastName}`)
    let userDocument
    if(user?.$id){
      const roleUserId = "669a2cfd00141edc45ef"
      const database = new Databases(client)
      userDocument = await database.createDocument(databaseName, 'user', ID.unique(), {
          username: username,
          userId: user.$id,
          firstname: firstName,
          lastname: lastName,
          email: email,
          phone: phone,
          type: 'user',
          address: address,
          user_roles: roleUserId,
      })
    }
    res.json({
        status: false,
        user: user,
        userDocument: userDocument,
    })
})

app.post("/sign-in", async (req, res) => {
    const body = req.body
    const phoneNumber = body.phoneNumber
    const userId = await checkExistUser(phoneNumber)
    let token
    if(userId){
      token = await getToken(userId)
    }
    
    // userId: userId || null,
    res.json(token)
})

app.post("/createPasscode", async (req, res) => {
  try {
    const body = req.body
    // const sessionId = req.headers['x-api-key']
    // console.log("🚀 ~ app.post ~ sessionId:", sessionId)
    const databases = new Databases(client)
    const { passcode, userId } = body
    console.log("🚀 ~ app.post ~ passcode:", passcode)
    console.log("🚀 ~ app.post ~ userId:", userId)
    const result = await databases.updateDocument(databaseName, 'user', userId,  {
      "passcode": passcode,
    })
    console.log("🚀 ~ app.post ~ result:", result)
    
    res.send("ok")
    
  } catch (error) {
    console.log("🚀 ~ app.post ~ error:", error)
    
    res.send("error")
  }
})

app.get("/currentTime", (req, res) => {
  const now = new Date
  // now.setHours(0, 0, 0, 0)
  res.setHeader("dateISO", now.toISOString())
  res.send(null)
})

app.get("/payment", (req, res) => {
  // TODO: invoice update to paid
  console.log("in payment !", (new Date).toISOString());
  
  res.send({
    message: 'test'
  })
})

app.listen(port, () => {
    console.log(`listen on port ${port}`);
    
})