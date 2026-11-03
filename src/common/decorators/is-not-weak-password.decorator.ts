import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { WEAK_PASSWORDS } from '../constants/weak-passwords.js';

export function IsNotWeakPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isNotWeakPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          return !WEAK_PASSWORDS.has(value.toLowerCase().trim());
        },
        defaultMessage(args: ValidationArguments) {
          return 'The chosen password is too common or easily guessed. Please choose a safer password.';
        },
      },
    });
  };
}
