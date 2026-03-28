export default {
  routes: [
    {
      method: "POST",
      path: "/admin-otp/login",
      handler: "admin-otp.login",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/admin-otp/verify",
      handler: "admin-otp.verify",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/admin-otp/resend",
      handler: "admin-otp.resend",
      config: {
        auth: false,
      },
    },
  ],
};
