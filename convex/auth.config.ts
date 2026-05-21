export default {
  providers: [
    {
      domain: process.env.FIREBASE_PROJECT_ID
        ? `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID}`
        : "https://securetoken.google.com/betterdata-68e98",
      applicationID: process.env.FIREBASE_PROJECT_ID ?? "betterdata-68e98",
    },
  ],
};
