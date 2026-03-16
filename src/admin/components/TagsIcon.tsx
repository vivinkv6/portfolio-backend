import React from 'react';
import { Flex } from '@strapi/design-system';

const TagsIcon = () => {
  return (
    <Flex justifyContent="center" alignItems="center" width={7} height={6} aria-hidden>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        width="1em"
        height="1em"
      >
        <path d="M20.59 10.59 13.41 3.41A2.01 2.01 0 0 0 12 3H5a2 2 0 0 0-2 2v7c0 .55.22 1.05.59 1.41l7.17 7.17c.37.37.88.59 1.41.59s1.04-.22 1.41-.59l7.41-7.41c.37-.37.59-.88.59-1.41s-.22-1.04-.59-1.41zM6.5 8C5.67 8 5 7.33 5 6.5S5.67 5 6.5 5 8 5.67 8 6.5 7.33 8 6.5 8z" />
      </svg>
    </Flex>
  );
};

export default TagsIcon;
