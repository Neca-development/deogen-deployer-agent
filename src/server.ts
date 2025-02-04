import express from "express";
import checkAuthorization from "./middlewares/auth.middleware";
import * as dotenv from "dotenv";
import errorHandlerMiddleware from "./middlewares/error-handler.middleware";
import router from "./routers/router";

dotenv.config();

async function main() {
    const app = express();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(checkAuthorization);

    app.use('/api/', router);

    app.use(errorHandlerMiddleware);
    
    app.listen(process.env.PORT);
}

main().then(_ => console.log(0)).catch(err => console.error(err));
