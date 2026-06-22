import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

// A tiny denylist of obvious choices. (A production system would also check
// against a breached-password corpus such as Have I Been Pwned's k-anonymity API.)
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'qwerty123456',
  'administrator',
  'changeme1234',
  'letmein12345',
]);

export function isStrongPassword(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) return false;
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return false;

  // Favor length, but still require a mix so 12 identical chars don't pass:
  // at least 3 of the 4 character classes.
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(value));
  return classes.length >= 3;
}

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isStrongPassword(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters and include at least 3 of: lowercase, uppercase, number, symbol`;
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
