import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { TextInput, Flex, Box, Field, Tag } from '@strapi/design-system';
import { Cross } from '@strapi/icons';

const TagsInput = React.forwardRef<HTMLInputElement, any>((props, ref) => {
  const { attribute, disabled, error, hint, intlLabel, name, onChange, required, value } = props;
  const { formatMessage } = useIntl();
  const [inputValue, setInputValue] = useState('');

  // value is stored as a JSON string under the 'text' type in the backend
  let tags: string[] = [];
  try {
    if (typeof value === 'string') {
      const parsed = JSON.parse(value || '[]');
      tags = Array.isArray(parsed) ? parsed : [];
    } else if (Array.isArray(value)) {
      tags = value;
    }
  } catch (e) {
    tags = [];
  }

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim().replace(/,$/, '');
      if (newTag && !tags.includes(newTag)) {
        const newTags = [...tags, newTag];
        onChange({
          target: {
            name,
            type: attribute.type,
            value: JSON.stringify(newTags),
          },
        });
        setInputValue('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    onChange({
      target: {
        name,
        type: attribute.type,
        value: JSON.stringify(newTags),
      },
    });
  };

  return (
    <Box>
      <Field.Root name={name} id={name} error={error} hint={hint || 'Press Enter or comma to add a tag'} required={required}>
        <Flex direction="column" alignItems="stretch" gap={1}>
          <Field.Label>{intlLabel ? formatMessage(intlLabel) : 'Tags'}</Field.Label>
          <TextInput
            ref={ref}
            name={name}
            disabled={disabled}
            placeholder="Type and press Enter to add tags"
            onChange={(e: any) => setInputValue(e.target.value)}
            onKeyDown={handleAddTag}
            value={inputValue}
          />
          <Field.Hint />
          <Field.Error />
        </Flex>
      </Field.Root>

      {tags.length > 0 && (
        <Flex gap={2} wrap="wrap" paddingTop={2}>
          {tags.map((tag: string) => (
            <Tag key={tag} icon={<Cross />} onClick={() => handleRemoveTag(tag)}>
              {tag}
            </Tag>
          ))}
        </Flex>
      )}
    </Box>
  );
});

export default TagsInput;
