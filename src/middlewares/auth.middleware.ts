import { NextFunction, Request, Response } from 'express';
import {IResponse} from "../interfaces/response.interface";

export default function checkAuthorization(
    request: Request,
    response: Response,
    nextFunction: NextFunction
) {
    try {
        if(process.env.X_API_KEY !== request.get("X-API-KEY")) {
            const result: IResponse = {
                data: null,
                error: "Wrong API keys"
            }

            response
                .status(403)
                .send(result);
        }

        nextFunction();
    }
    catch(error) {
        nextFunction(error);
    }
}
