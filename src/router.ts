import express, {Request, Response} from 'express';
const router = express.Router();

router.get("/", (req: Request, res: Response) => {
    res.send("Home page")
})

router.get("/login", (req: Request, res: Response) => {
    res.send("login page")
})

router.get("/signup", (req: Request, res: Response) => {
    res.send("Signup page")
})

export default router
