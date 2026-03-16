import type { Core } from "@strapi/strapi";

const config = ({
  env,
}: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  upload: {
    config: {
      provider: "cloudinary",
      providerOptions: {
        cloud_name: env("CLOUDINARY_NAME"),
        api_key: env("CLOUDINARY_KEY"),
        api_secret: env("CLOUDINARY_SECRET"),
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
      // Disable auto orientation to reduce file locking issues on Windows
      autoOrientation: false,
    },
  },
    email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: 'smtp.gmail.com',
        port: 587,
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD
        },
        secure: false,
        tls: {
          rejectUnauthorized: false
        }
      },
      settings: {
        defaultFrom: process.env.SMTP_USERNAME,
        defaultReplyTo: process.env.SMTP_USERNAME
      }
    }
  },
});

export default config;
