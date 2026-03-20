import type { StrapiApp } from "@strapi/strapi/admin";
import TagsIcon from "./components/TagsIcon";
import Logo from "./extensions/logo.png";
import favicon from "./extensions/favicon.ico";

export default {
  config: {
    locales: [
      // 'ar',
      // 'fr',
      // 'cs',
      // 'de',
      // 'dk',
      // 'es',
      // 'he',
      // 'id',
      // 'it',
      // 'ja',
      // 'ko',
      // 'ms',
      // 'nl',
      // 'no',
      // 'pl',
      // 'pt-BR',
      // 'pt',
      // 'ru',
      // 'sk',
      // 'sv',
      // 'th',
      // 'tr',
      // 'uk',
      // 'vi',
      // 'zh-Hans',
      // 'zh',
    ],
    auth: {
      logo: Logo,
    },
    head: {
      favicon: favicon,
    },
    menu: {
      logo: Logo,
    },
/*
    tutorials: false,
    notifications: {
      releases: false,
    },
    */
    translations: {
      en: {
        "app.components.LeftMenu.navbrand.title": "Admin Dashboard",
        "app.components.LeftMenu.navbrand.workplace": "Management Panel",

        "Auth.form.welcome.title": "Welcome to the Dashboard",
        "Auth.form.welcome.subtitle": "Login to access the admin panel",

        "Auth.form.register.subtitle":
          "Your credentials are used only for secure authentication. All data will be safely stored and managed within the system.",

        "Settings.profile.form.section.experience.interfaceLanguageHelp":
          "Language preferences will apply only to your account",
        "Settings.permissions.users.listview.header.subtitle": "All the users who have access to the Admin panel",
      },
    },
  },
  bootstrap(app: StrapiApp) {
    document.title="Admin Dashboard"
  },
  register(app: StrapiApp) {
    app.customFields.register({
      name: "tags",
      type: "text",
      icon: TagsIcon,
      intlLabel: {
        id: "tags.label",
        defaultMessage: "Tags",
      },
      intlDescription: {
        id: "tags.description",
        defaultMessage: "A multi-value tagging component",
      },
      components: {
        Input: async () =>
          import("./components/TagsInput").then((module) => ({
            default: module.default,
          })),
      },
      options: {
        base: [],
        advanced: [
          {
            sectionTitle: {
              id: "global.settings",
              defaultMessage: "Settings",
            },
            items: [
              {
                name: "required",
                type: "checkbox",
                intlLabel: {
                  id: "form.attribute.item.requiredField",
                  defaultMessage: "Required field",
                },
                description: {
                  id: "form.attribute.item.requiredField.description",
                  defaultMessage:
                    "You won't be able to create an entry if this field is empty",
                },
              },
            ],
          },
        ],
      },
    });
  },
};
