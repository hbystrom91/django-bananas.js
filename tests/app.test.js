import fetchMock from "fetch-mock";
import Logger from "js-logger";
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  wait,
  waitForElement,
} from "react-testing-library";

import Bananas from "../src";
import { mockAPI } from "./api.mock";

Logger.get("bananas").setLevel(Logger.OFF);

const renderApp = async ({ anonymous } = {}) => {
  mockAPI({ anonymous });

  const helpers = render(
    <Bananas.App
      api="http://foo.bar/api"
      pages={route => import(`./pages/${route}`)}
      logLevel="OFF"
      title="Test Title"
      branding="Test Branding"
      version="v1.2.3"
    />
  );

  await wait(() => window.bananas);
  const app = window.bananas;

  if (!anonymous) {
    const { container, getByText } = helpers;
    const profileMenuItem = () => getByText(app.user.full_name);
    await waitForElement(profileMenuItem, { container });
  }

  return { ...helpers, app };
};

afterEach(cleanup);

test("Has App", () => {
  expect(Bananas.App).toBeDefined();
  expect(typeof Bananas.App).toBe("function");
});

test("Can boot and login", async () => {
  const { app, container, getByText, getByLabelText } = await renderApp({
    anonymous: true,
  });

  // Wait for login form to be rendered
  const loginSubmitButton = () => getByLabelText("login");
  await waitForElement(loginSubmitButton, { container });

  // Fill login form and click login submit button
  const username = getByLabelText("Username", { selector: "input" });
  const password = getByLabelText("Password", { selector: "input" });
  fireEvent.change(username, { target: { value: "admin" } });
  fireEvent.change(password, { target: { value: "test" } });
  fireEvent.click(loginSubmitButton());

  // Wait for logged in username to be rendered, i.e. NavBar is rendered
  const profileMenuItem = () => getByText(app.user.full_name);
  await waitForElement(profileMenuItem, { container });
});

test("Can render dashboard and navigate using menu", async () => {
  const { app, container, getByText, queryAllByText } = await renderApp();

  // Expect branding etc to rendered
  expect(document.title).toBe("Dashboard | Test Title");
  expect(getByText("Test Branding")).toBeTruthy();
  expect(getByText("v1.2.3")).toBeTruthy();

  // Expect dashboard page to be rendered
  expect(getByText("Dashboard Test Page")).toBeTruthy();

  // Expect users menu item to be rendered
  const userListRoute = app.router.getRoute("example.user:list");
  const usersMenuItem = getByText(userListRoute.title);
  expect(usersMenuItem).toBeTruthy();

  // Mock Users API call
  const users = [{ id: 1, username: "user1" }, { id: 2, username: "user2" }];
  fetchMock.mock(`http://foo.bar/api/v1.0${userListRoute.path}`, {
    body: users,
  });

  // Click Users menu item
  fireEvent.click(usersMenuItem);

  // Wait for user list page to be rendered
  await waitForElement(() => getByText(`${userListRoute.title} (users)`), {
    container,
  });

  // Expect a listed user link to be rendered
  const user1Link = getByText(users[0].username);
  expect(user1Link).toBeTruthy();

  // Click one of the users and expect page template not to implemented
  fireEvent.click(user1Link);
  await waitForElement(() => getByText("Page Not Implemented"), {
    container,
  });

  // Click profile menu item
  const profileMenuItem = () => getByText(app.user.full_name);
  fireEvent.click(profileMenuItem());

  // Wait for password form and therefore profile page to be rendered
  const changePasswordRoute = app.router.getRoute(
    "bananas.change_password:create"
  );
  await waitForElement(() => getByText(changePasswordRoute.title), {
    container,
  });

  // Expect logged in username to rendered twice (menu and page title)
  expect(queryAllByText(app.user.full_name)).toHaveLength(2);
});

test("Can trigger and render messages", async () => {
  const { app, container, getByText, queryByText } = await renderApp();

  // Expect no messages showing
  expect(queryByText("client-snackbar")).toBeNull();

  app.success("SUCCESS_MSG");
  await waitForElement(() => getByText("SUCCESS_MSG"), { container });

  app.info("INFO_MSG");
  await waitForElement(() => getByText("INFO_MSG"), { container });

  app.warning("WARNING_MSG");
  await waitForElement(() => getByText("WARNING_MSG"), { container });

  app.error("ERROR_MSG");
  await waitForElement(() => getByText("ERROR_MSG"), { container });
});
