import type { Schema, Struct } from '@strapi/strapi';

export interface AboutStats extends Struct.ComponentSchema {
  collectionName: 'components_about_stats';
  info: {
    displayName: 'Stats';
  };
  attributes: {
    count: Schema.Attribute.String;
    short_title: Schema.Attribute.String;
  };
}

export interface AcademicJourney extends Struct.ComponentSchema {
  collectionName: 'components_academic_journeys';
  info: {
    displayName: 'Journey';
  };
  attributes: {
    content: Schema.Attribute.Text;
    end_date: Schema.Attribute.Date;
    start_date: Schema.Attribute.Date;
    title: Schema.Attribute.String;
  };
}

export interface BlogSection extends Struct.ComponentSchema {
  collectionName: 'components_blog_sections';
  info: {
    displayName: 'Section';
  };
  attributes: {
    content: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    image: Schema.Attribute.Media<'images'>;
    title: Schema.Attribute.String;
  };
}

export interface CommonButton extends Struct.ComponentSchema {
  collectionName: 'components_common_buttons';
  info: {
    displayName: 'Button';
  };
  attributes: {
    label: Schema.Attribute.String;
    link: Schema.Attribute.String;
  };
}

export interface CommonContentBlock extends Struct.ComponentSchema {
  collectionName: 'components_common_content_blocks';
  info: {
    displayName: 'Content Block';
  };
  attributes: {
    content: Schema.Attribute.Text;
  };
}

export interface CommonError extends Struct.ComponentSchema {
  collectionName: 'components_common_errors';
  info: {
    displayName: 'Error';
  };
  attributes: {
    button1: Schema.Attribute.Component<'common.button', false>;
    button2: Schema.Attribute.Component<'common.button', false>;
    short_description: Schema.Attribute.String;
    status_code: Schema.Attribute.Integer;
    tag: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface CommonGtm extends Struct.ComponentSchema {
  collectionName: 'components_common_gtms';
  info: {
    displayName: 'GTM';
  };
  attributes: {
    body_script: Schema.Attribute.Text;
    head_script: Schema.Attribute.Text;
    other_script: Schema.Attribute.Text;
  };
}

export interface CommonSeo extends Struct.ComponentSchema {
  collectionName: 'components_common_seos';
  info: {
    displayName: 'SEO';
  };
  attributes: {
    extra_js: Schema.Attribute.Text;
    keyword: Schema.Attribute.Text;
    meta_description: Schema.Attribute.Text;
    meta_title: Schema.Attribute.String;
    og_description: Schema.Attribute.Text;
    og_image: Schema.Attribute.Media<'images'>;
    og_title: Schema.Attribute.String;
  };
}

export interface CommonSocialMedia extends Struct.ComponentSchema {
  collectionName: 'components_common_social_medias';
  info: {
    displayName: 'Social Media';
  };
  attributes: {
    facebook_url: Schema.Attribute.String;
    github_link: Schema.Attribute.String;
    gmail: Schema.Attribute.String;
    instagram_link: Schema.Attribute.String;
    linkedin_url: Schema.Attribute.String;
    twitter_link: Schema.Attribute.String;
  };
}

export interface HomeHeroSection extends Struct.ComponentSchema {
  collectionName: 'components_home_hero_sections';
  info: {
    displayName: 'Hero Section';
  };
  attributes: {
    button1: Schema.Attribute.Component<'common.button', false>;
    button2: Schema.Attribute.Component<'common.button', false>;
    image: Schema.Attribute.Media<'images'>;
    roles: Schema.Attribute.String;
    short_description: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface MenuFooter extends Struct.ComponentSchema {
  collectionName: 'components_menu_footers';
  info: {
    displayName: 'Footer';
  };
  attributes: {
    label: Schema.Attribute.String;
    menu: Schema.Attribute.Component<'common.button', true>;
  };
}

export interface MenuHeader extends Struct.ComponentSchema {
  collectionName: 'components_menu_headers';
  info: {
    displayName: 'Header';
  };
  attributes: {
    menu: Schema.Attribute.Component<'common.button', true>;
  };
}

export interface MenuMenuGroup extends Struct.ComponentSchema {
  collectionName: 'components_menu_menu_groups';
  info: {
    displayName: 'Menu Group';
  };
  attributes: {
    label: Schema.Attribute.String;
    menu: Schema.Attribute.Component<'common.button', true>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'about.stats': AboutStats;
      'academic.journey': AcademicJourney;
      'blog.section': BlogSection;
      'common.button': CommonButton;
      'common.content-block': CommonContentBlock;
      'common.error': CommonError;
      'common.gtm': CommonGtm;
      'common.seo': CommonSeo;
      'common.social-media': CommonSocialMedia;
      'home.hero-section': HomeHeroSection;
      'menu.footer': MenuFooter;
      'menu.header': MenuHeader;
      'menu.menu-group': MenuMenuGroup;
    }
  }
}
