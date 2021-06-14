import DFManualRolls from "./DFManualRolls.js";
import SETTINGS from "./lib/Settings.js";

interface RollPromptData {
	id: number;
	res: Function;
	term: DiceTerm;
}
interface RenderData {
	id: string;
	idx: number;
	faces: string;
	hasTotal: boolean;
	term: DiceTerm
}

export default class DFRollPrompt extends FormApplication<{ terms: RenderData[] }> {

	private _nextId = 0;
	private _terms: RollPromptData[] = [];
	private _rolled = false;

	static get defaultOptions(): FormApplication.Options {
		return <FormApplication.Options>mergeObject(
			<DeepPartial<FormApplication.Options>>FormApplication.defaultOptions,
			{
				title: game.i18n.localize("DF_MANUAL_ROLLS.Prompt_DefaultTitle"),
				template: `modules/${SETTINGS.MOD_NAME}/templates/roll-prompt.hbs`,
				width: 400,

			});
	}

	getData(options?: Application.RenderOptions): { terms: RenderData[] } {
		const data: RenderData[] = [];
		for (let term of this._terms) {
			const die = term.term;
			for (let c = 0; c < die.number; c++) {
				data.push({
					id: term.id.toString(),
					idx: c,
					faces: c == 0 ? `${die.number}d${die.faces}${die.modifiers.length > 0 ? ' [' + die.modifiers.join(',') + ']' : ''}` : '',
					hasTotal: c == 0 && die.modifiers.length == 0 && die.number > 1,
					term: die
				});
			}
		}
		return { terms: data };
	}
	close(options?: FormApplication.CloseOptions): Promise<void> {
		// If we have not actually rolled anything yet, we need to resolve these with RNG values
		if (!this._rolled) {
			this._rolled = true;
			for (let x of this._terms) {
				const results: number[] = [];
				for (let c = 0; c < x.term.number; c++) {
					results.push(Math.ceil(CONFIG.Dice.randomUniform() * x.term.faces));
				}
				x.res(results);
			}
		}
		return super.close(options);
	}
	protected _updateObject(event: Event, formData?: { [key: string]: string | null }): Promise<unknown> {
		for (let x of this._terms) {
			const results: number[] = [];
			const total = formData[`${x.id}-total`];
			// If a total input was defined and given, it overrides everything else.
			if (total !== undefined && total !== null) {
				const value = parseInt(total);
				const base = Math.ceil(value / x.term.number);
				// Append dice with the base average of the total.
				for (let c = 0; c < x.term.number - 1; c++) {
					results.push(base);
				}
				// If the final roll is below the base average, calculate it and add it in
				if (value % base !== 0) results.push(value % base);
				// Otherwise the base was evenly divided and we can just add the base for the final roll
				else results.push(base);
				if (DFManualRolls.flagged)
					x.term.options.flavor = (x.term.options.flavor || '') + '[MRT]';
			} else {
				const flags = [];
				for (let c = 0; c < x.term.number; c++) {
					const roll = formData[`${x.id}-${c}`];
					var value = parseInt(roll);
					if (isNaN(value)) {
						value = Math.ceil(CONFIG.Dice.randomUniform() * x.term.faces);
						flags.push('RN');
					} else {
						flags.push('MR');
						(<any>x.term.options).isManualRoll = true;
					}
					results.push(value);
				}
				if (DFManualRolls.flagged && flags.some(x => x === 'MR')) {
					x.term.options.flavor = (x.term.options.flavor || '') + '[' + flags.join(',') + ']';
					(<any>x.term.options).isManualRoll = true;
				}
			}
			x.res(results);
		}
		this._rolled = true;
		return undefined;
	}

	requestResult(term: DiceTerm): Promise<number[]> {
		return new Promise((res, _) => this._terms.push({ id: this._nextId++, res, term }));
	}
}