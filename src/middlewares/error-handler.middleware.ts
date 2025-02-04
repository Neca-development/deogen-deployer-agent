import { NextFunction, Request, Response } from 'express';
import { IResponse } from '../interfaces/response.interface';
import { AxiosError } from 'axios';

export default function errorHandlerMiddleware(
    error: Error,
    request: Request,
    response: Response,
    nextFunction: NextFunction
) {
    const result: IResponse = {
        data: null,
        error: error.message
    }

    if (error instanceof AxiosError) {
        result.error = error.response?.data ?? error.message;
    }

    response
        .status(500)
        .send(result);
}
