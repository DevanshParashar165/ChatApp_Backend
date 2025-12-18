import mongoose from "mongoose";

//Function to connect mongoDB database

export const connectDB = async()=>{
    try {
        mongoose.connection.on('connected',()=>console.log("Database Connected"))
        await mongoose.connect(`${process.env.MONGO_URI}`)
    } catch (error) {
        console.log("Error while connecting database : ",error)
    }
}