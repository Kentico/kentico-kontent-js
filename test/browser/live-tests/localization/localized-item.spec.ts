import { ItemResponses } from '../../../../lib';
import { Context, Movie, setup } from '../../setup';

describe('Localized item', () => {
    const context = new Context();
    setup(context);

    const language: string = 'cz';
    const movieCodename: string = 'warrior';
    let response: ItemResponses.ViewContentItemResponse<Movie>;

    beforeAll(async () => {
        response = await context.deliveryClient.item<Movie>(movieCodename).languageParameter(language).toPromise();
    });

    it(`language should be '${language}'`, () => {
        expect(response.item.system.language).toEqual(language);
    });

    it(`title should be localized`, () => {
        expect(response.item.title.value).toEqual('Warrior-cz');
    });
});
