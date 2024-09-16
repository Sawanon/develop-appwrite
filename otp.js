import {Router} from "express";

const router = Router()

router.post("/verifyOTP", (req, res) => {
    res.json({
        message: "ok"
    })
})

export {
    router
}