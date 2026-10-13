import { createUser } from "@/lib/commands";
import { action } from "@/lib/action";
import { userCreateSchema } from "@/lib/schemas";

export const POST = action("user.manage", userCreateSchema, (session, body, key) =>
  createUser(
    session,
    {
      name: body.name,
      email: body.email,
      phone: body.phone,
      password: body.password,
      roleCode: body.roleCode,
    },
    key,
  ),
);
